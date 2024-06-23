// multi_agents/gpt_researcher_nextjs/app/page.tsx

"use client";

import Answer from "@/components/Answer";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import InputArea from "@/components/InputArea";
import SimilarTopics from "@/components/SimilarTopics";
import Sources from "@/components/Sources";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import AccessReport from '../components/Task/AccessReport';
import Accordion from '../components/Task/Accordion';

import { handleSourcesAndAnswer, handleSimilarQuestions, handleLanggraphAnswer } from '../actions/apiActions';
import { startLanggraphResearch } from '../components/Langgraph/Langgraph';

export default function Home() {
  const [promptValue, setPromptValue] = useState("");
  const [question, setQuestion] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [sources, setSources] = useState<{ name: string; url: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [similarQuestions, setSimilarQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatBoxSettings, setChatBoxSettings] = useState({report_source: 'web', report_type: 'multi_agents'});
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [socket, setSocket] = useState(null);
  const [orderedData, setOrderedData] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { protocol, pathname } = window.location;
      let { host } = window.location;
      host = host.includes('localhost') ? 'localhost:8000' : host;
      const ws_uri = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${pathname}ws`;
      
      const newSocket = new WebSocket(ws_uri);
      setSocket(newSocket);

      newSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('websocket data caught in frontend: ', data);
        const contentAndType = `${data.content}-${data.type}`;
        setOrderedData((prevOrder) => [...prevOrder, { ...data, contentAndType }]);

        if (data.type === 'report') {
          setAnswer((prev) => prev + data.output);
        } else if (data.type === 'path') {
          setLoading(false);
        }
      };

      return () => newSocket.close();
    }
  }, []);

  const startResearch = (chatBoxSettings) => {
    const {task, report_type, report_source} = chatBoxSettings;
    
    let data = "start " + JSON.stringify({ task: promptValue, report_type, report_source });
    socket.send(data);
  };

  const handleDisplayResult = async (newQuestion?: string) => {
    newQuestion = newQuestion || promptValue;

    setShowResult(true);
    setLoading(true);
    setQuestion(newQuestion);
    setPromptValue("");
    setAnswer(""); // Reset answer for new query

    if (chatBoxSettings.report_type === 'multi_agents') {
      let {streamResponse, host, thread_id} = await startLanggraphResearch(newQuestion);

      console.log('langsmith-gui-link in page.tsx', `https://smith.langchain.com/studio/thread/${thread_id}?baseUrl=${host}`)

      for await (const chunk of streamResponse) {
        console.log(chunk);
      }

    } else {
      startResearch(chatBoxSettings);

      // await Promise.all([
      //   handleSourcesAndAnswer(newQuestion),
      //   handleSimilarQuestions(newQuestion),
      // ]);
    }
  };

  const reset = () => {
    setShowResult(false);
    setPromptValue("");
    setQuestion("");
    setAnswer("");
    setSources([]);
    setSimilarQuestions([]);
  };

  const handleClickSuggestion = (value: string) => {
    setPromptValue(value);
    const element = document.getElementById('input-area');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const preprocessOrderedData = (data) => {
    const groupedData = [];
    let currentAccordionGroup = null;
    let currentSourceGroup = null;
    let currentReportGroup = null;

    data.forEach((item) => {
      const { type, content, metadata, output } = item;

      if (type === 'report') {
        if (!currentReportGroup) {
          currentReportGroup = { type: 'reportBlock', content: '' };
          groupedData.push(currentReportGroup);
        }
        currentReportGroup.content += output;
      } else {
        if (currentReportGroup) {
          currentReportGroup = null;
        }

        if (content === 'subqueries') {
          if (currentAccordionGroup) {
            currentAccordionGroup = null;
          }
          if (currentSourceGroup) {
            groupedData.push(currentSourceGroup);
            currentSourceGroup = null;
          }
          groupedData.push(item);
        } else if (content === 'added_source_url') {
          if (!currentSourceGroup) {
            currentSourceGroup = { type: 'sourceBlock', items: [] };
            groupedData.push(currentSourceGroup);
          }
          const hostname = new URL(metadata).hostname.replace('www.', '');
          currentSourceGroup.items.push({ name: hostname, url: metadata });
        } else if (type !== 'path' && content !== '') {
          if (!currentAccordionGroup) {
            currentAccordionGroup = { type: 'accordionBlock', items: [] };
            groupedData.push(currentAccordionGroup);
          }
          currentAccordionGroup.items.push(item);
        } else {
          if (currentAccordionGroup) {
            currentAccordionGroup = null;
          }
          if (currentSourceGroup) {
            groupedData.push(currentSourceGroup);
            currentSourceGroup = null;
          }
          groupedData.push(item);
        }
      }
    });

    return groupedData;
  };

  const renderComponentsInOrder = () => {
    const groupedData = preprocessOrderedData(orderedData);

    return groupedData.map((data, index) => {
      if (data.type === 'accordionBlock') {
        const uniqueKey = `accordionBlock-${index}`;
        const logs = data.items.map((item, subIndex) => ({
          header: item.content,
          text: item.output,
          key: `${item.type}-${item.content}-${subIndex}`,
        }));
        return <Accordion key={uniqueKey} logs={logs} />;
      } else if (data.type === 'sourceBlock') {
        const uniqueKey = `sourceBlock-${index}`;
        return <Sources key={uniqueKey} sources={data.items} isLoading={false} />;
      } else if (data.type === 'reportBlock') {
        const uniqueKey = `reportBlock-${index}`;
        return <Answer key={uniqueKey} answer={data.content} />;
      } else {
        const { type, content, metadata, output } = data;
        const uniqueKey = `${type}-${content}-${index}`;

        if (content === 'subqueries') {
          return (
            <div key={uniqueKey} className="flex flex-col items-center gap-2.5 pb-[30px]">
              {metadata.map((item, subIndex) => (
                <div
                  className="flex cursor-pointer items-center justify-center gap-[5px] rounded-full border border-solid border-[#C1C1C1] bg-[#EDEDEA] px-2.5 py-2"
                  onClick={() => handleClickSuggestion(item)}
                  key={`${uniqueKey}-${subIndex}`}
                >
                  <span className="text-sm font-light leading-[normal] text-[#1B1B16]">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          );
        } else if (type === 'path') {
          return <AccessReport key={uniqueKey} accessData={output} report={answer} />;
        } else {
          return null;
        }
      }
    });
  };

  return (
    <>
      <Header />
      <main className="h-full px-4 pb-4">
        {!showResult && (
          <Hero
            promptValue={promptValue}
            setPromptValue={setPromptValue}
            handleDisplayResult={handleDisplayResult}
          />
        )}

        {showResult && (
          <div className="flex h-full min-h-[68vh] w-full grow flex-col justify-between">
            <div className="container w-full space-y-2">
              <div className="container space-y-2">
                <div className="container flex w-full items-start gap-3 px-5 pt-2 lg:px-10">
                  <div className="flex w-fit items-center gap-4">
                    <Image
                      src={"/img/message-question-circle.svg"}
                      alt="message"
                      width={30}
                      height={30}
                      className="size-[24px]"
                    />
                    <p className="pr-5 font-bold uppercase leading-[152%] text-white">
                      Question:
                    </p>
                  </div>
                  <div className="grow text-white">&quot;{question}&quot;</div>
                </div>
                {renderComponentsInOrder()}
              </div>

              <div className="pt-1 sm:pt-2" ref={chatContainerRef}></div>
            </div>
            <div id="input-area" className="container px-4 lg:px-0">
              <InputArea
                promptValue={promptValue}
                setPromptValue={setPromptValue}
                handleDisplayResult={handleDisplayResult}
                disabled={loading}
                reset={reset}
              />
            </div>
          </div>
        )}
      </main>
      <Footer setChatBoxSettings={setChatBoxSettings} chatBoxSettings={chatBoxSettings} />
    </>
  );
}