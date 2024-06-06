import React, { useState } from 'react';
import axios from 'axios';

const InputArea: React.FC = () => {
  const [query, setQuery] = useState('');
  const [report, setReport] = useState(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleSearch = async () => {
    if (!query) {
      alert('Please enter a query');
      return;
    }

    const requestData = {
      query: query,
      model: "gpt-4o",
      max_sections: 3,
      publish_formats: {
        markdown: true,
        pdf: true,
        docx: true
      },
      follow_guidelines: true,
      guidelines: [
        "The report MUST fully answer the original question",
        "The report MUST be written in apa format",
        "The report MUST be written in english"
      ],
      verbose: true
    };

    try {
      const response = await axios.post('/generate_report', requestData);
      setReport(response.data.report);
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while generating the report');
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Enter your query"
      />
      <button onClick={handleSearch}>Search</button>
      {report && (
        <div>
          <h2>Research Report</h2>
          <pre>{JSON.stringify(report, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default InputArea;