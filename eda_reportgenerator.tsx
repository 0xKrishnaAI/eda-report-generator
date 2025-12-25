import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const EDAAnalyzer = () => {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          alert('Dataset is empty or could not be parsed');
          setLoading(false);
          return;
        }

        setData(jsonData);
        performAnalysis(jsonData);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing file: ' + error.message);
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadReport = () => {
    // Generate Word document content
    let docContent = `
EXPLORATORY DATA ANALYSIS (EDA) SUMMARY REPORT
Delinquency Prediction Dataset Analysis
Generated: ${new Date().toLocaleDateString()}

================================================================

1. INTRODUCTION

This report presents a comprehensive exploratory data analysis of the Delinquency Prediction Dataset. The primary goal is to understand the dataset structure, identify data quality issues, uncover patterns and relationships between variables, and provide actionable insights for building a predictive model to assess delinquency risk factors.

================================================================

2. DATASET OVERVIEW

Key Dataset Attributes:
- Number of records: ${analysis.recordCount.toLocaleString()}
- Total variables: ${analysis.columns.length}
- Numerical variables: ${analysis.numericColumns.length}
- Categorical variables: ${analysis.categoricalColumns.length}
- Data quality: ${Object.keys(analysis.missingData).length === 0 ? 'Excellent' : 'Needs Attention'}

Numerical Variables:
${analysis.numericColumns.join(', ')}

Categorical Variables:
${analysis.categoricalColumns.join(', ')}

================================================================

3. MISSING DATA ANALYSIS

${Object.keys(analysis.missingData).length === 0
        ? 'No missing values detected in the dataset.'
        : `The following variables contain missing values that require treatment before modeling:

${Object.entries(analysis.missingData).map(([col, stats]) => {
          const treatment = parseFloat(stats.percentage) < 5 ? 'Mean/Median Imputation' :
            parseFloat(stats.percentage) < 30 ? 'Advanced Imputation (KNN/MICE)' :
              'Consider Removal or Flag as Missing';
          return `- ${col}: ${stats.count} missing (${stats.percentage}%) - Recommended: ${treatment}`;
        }).join('\n')}`}

================================================================

4. KEY FINDINGS AND RISK INDICATORS

Descriptive Statistics (Top 10 Numerical Variables):

${Object.entries(analysis.numStats).slice(0, 10).map(([col, stats]) =>
          `${col}:
  - Count: ${stats.count}
  - Mean: ${stats.mean}
  - Median: ${stats.median}
  - Min: ${stats.min}
  - Max: ${stats.max}`
        ).join('\n\n')}

${analysis.correlations.length > 0 ? `
Significant Correlations:

${analysis.correlations.map(corr =>
          `- ${corr.col1} ↔ ${corr.col2}: r = ${corr.corr}`
        ).join('\n')}` : ''}

${Object.keys(analysis.catStats).length > 0 ? `
Categorical Variable Distribution (Top Categories):

${Object.entries(analysis.catStats).slice(0, 4).map(([col, freq]) =>
          `${col}:
${freq.map(([val, count]) => `  - ${val}: ${count}`).join('\n')}`
        ).join('\n\n')}` : ''}

================================================================

5. AI & GENAI USAGE

This analysis utilized AI-powered automated statistical analysis and pattern detection. The following approaches were employed:

Example AI Prompts Used:
- "Analyze the dataset structure and identify key variables with their data types"
- "Calculate descriptive statistics for all numerical variables"
- "Identify correlations between numerical variables that exceed 0.3 threshold"
- "Detect missing data patterns and recommend appropriate imputation strategies"
- "Analyze categorical variable distributions for anomaly detection"

================================================================

6. CONCLUSION & NEXT STEPS

Key Findings Summary:
- Dataset contains ${analysis.recordCount.toLocaleString()} records with ${analysis.columns.length} variables
- Identified ${analysis.numericColumns.length} numerical and ${analysis.categoricalColumns.length} categorical features
- Missing data detected in ${Object.keys(analysis.missingData).length} variable(s), requiring treatment
- Found ${analysis.correlations.length} significant correlations between variables

Recommended Next Steps:
1. Address missing data using recommended imputation strategies
2. Perform feature engineering based on identified correlations
3. Conduct outlier detection and treatment for numerical variables
4. Encode categorical variables for model compatibility
5. Split data into training and testing sets
6. Begin predictive model development using identified risk indicators

================================================================
END OF REPORT
`;

    // Create blob and download
    const blob = new Blob([docContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EDA_Summary_Report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const performAnalysis = (jsonData) => {
    if (!jsonData || jsonData.length === 0) {
      setLoading(false);
      return;
    }

    // Basic stats
    const recordCount = jsonData.length;
    const columns = Object.keys(jsonData[0]);

    // Data types analysis
    const dataTypes = {};
    const numericColumns = [];
    const categoricalColumns = [];

    columns.forEach(col => {
      const sampleValues = jsonData.slice(0, 100).map(row => row[col]).filter(v => v != null);
      const isNumeric = sampleValues.every(v => typeof v === 'number' || !isNaN(Number(v)));

      if (isNumeric) {
        dataTypes[col] = 'Numerical';
        numericColumns.push(col);
      } else {
        dataTypes[col] = 'Categorical';
        categoricalColumns.push(col);
      }
    });

    // Missing data analysis
    const missingData = {};
    columns.forEach(col => {
      const missing = jsonData.filter(row => row[col] == null || row[col] === '' || row[col] === 'NA').length;
      if (missing > 0) {
        missingData[col] = {
          count: missing,
          percentage: ((missing / recordCount) * 100).toFixed(2)
        };
      }
    });

    // Descriptive statistics for numerical columns
    const numStats = {};
    numericColumns.forEach(col => {
      const values = jsonData.map(row => Number(row[col])).filter(v => !isNaN(v));
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const median = values[Math.floor(values.length / 2)];
        const min = values[0];
        const max = values[values.length - 1];

        numStats[col] = { mean: mean.toFixed(2), median, min, max, count: values.length };
      }
    });

    // Correlation analysis (for key numeric variables)
    const correlations = calculateCorrelations(jsonData, numericColumns.slice(0, 10));

    // Categorical analysis
    const catStats = {};
    categoricalColumns.slice(0, 8).forEach(col => {
      const freq = {};
      jsonData.forEach(row => {
        const val = row[col];
        if (val != null && val !== '') {
          freq[val] = (freq[val] || 0) + 1;
        }
      });
      catStats[col] = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    });

    setAnalysis({
      recordCount,
      columns,
      dataTypes,
      numericColumns,
      categoricalColumns,
      missingData,
      numStats,
      correlations,
      catStats
    });
    setLoading(false);
  };

  const calculateCorrelations = (data, cols) => {
    const results = [];
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const col1 = cols[i];
        const col2 = cols[j];
        const pairs = data.map(row => [Number(row[col1]), Number(row[col2])])
          .filter(([a, b]) => !isNaN(a) && !isNaN(b));

        if (pairs.length > 10) {
          const corr = pearsonCorrelation(pairs);
          if (Math.abs(corr) > 0.3) {
            results.push({ col1, col2, corr: corr.toFixed(3) });
          }
        }
      }
    }
    return results.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)).slice(0, 10);
  };

  const pearsonCorrelation = (pairs) => {
    const n = pairs.length;
    const sum1 = pairs.reduce((s, [x]) => s + x, 0);
    const sum2 = pairs.reduce((s, [, y]) => s + y, 0);
    const sum1Sq = pairs.reduce((s, [x]) => s + x * x, 0);
    const sum2Sq = pairs.reduce((s, [, y]) => s + y * y, 0);
    const pSum = pairs.reduce((s, [x, y]) => s + x * y, 0);

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    return den === 0 ? 0 : num / den;
  };

  if (!analysis && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full border border-indigo-100">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
              <svg className="w-16 h-16 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">EDA Report Generator</h1>
            <p className="text-gray-600">Upload your delinquency prediction dataset to begin analysis</p>
          </div>

          <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer bg-indigo-50">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <svg className="mx-auto h-12 w-12 text-indigo-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-lg font-semibold text-gray-700 mb-2">Click to upload Excel file</p>
              <p className="text-sm text-gray-500">or drag and drop your .xlsx or .xls file here</p>
            </label>
          </div>

          <div className="mt-6 text-sm text-gray-500 text-center">
            <p>Supported formats: Excel (.xlsx, .xls)</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Analyzing dataset...</p>
          <p className="text-sm text-gray-500 mt-2">{fileName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 bg-white rounded-lg shadow-lg p-8 border-l-4 border-indigo-600">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Exploratory Data Analysis (EDA) Summary Report</h1>
              <p className="text-gray-600">Delinquency Prediction Dataset Analysis</p>
              <p className="text-sm text-gray-500 mt-1">File: {fileName}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadReport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Report
              </button>
              <button
                onClick={() => { setAnalysis(null); setData(null); setFileName(''); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Upload New File
              </button>
            </div>
          </div>
        </header>

        {/* Section 1: Introduction */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">1. Introduction</h2>
          <p className="text-gray-700 leading-relaxed">
            This report presents a comprehensive exploratory data analysis of the Delinquency Prediction Dataset.
            The primary goal is to understand the dataset structure, identify data quality issues, uncover patterns
            and relationships between variables, and provide actionable insights for building a predictive model
            to assess delinquency risk factors.
          </p>
        </section>

        {/* Section 2: Dataset Overview */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">2. Dataset Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Records</p>
              <p className="text-3xl font-bold text-blue-700">{analysis.recordCount.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 mb-1">Total Variables</p>
              <p className="text-3xl font-bold text-green-700">{analysis.columns.length}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Data Quality</p>
              <p className="text-3xl font-bold text-purple-700">
                {Object.keys(analysis.missingData).length === 0 ? 'Excellent' : 'Needs Attention'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Key Variables & Data Types:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-semibold text-blue-800 mb-2">Numerical Variables ({analysis.numericColumns.length}):</p>
                <div className="max-h-40 overflow-y-auto text-sm text-gray-700">
                  {analysis.numericColumns.map((col, idx) => (
                    <span key={idx} className="inline-block bg-blue-100 px-2 py-1 rounded mr-2 mb-2">{col}</span>
                  ))}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="font-semibold text-green-800 mb-2">Categorical Variables ({analysis.categoricalColumns.length}):</p>
                <div className="max-h-40 overflow-y-auto text-sm text-gray-700">
                  {analysis.categoricalColumns.map((col, idx) => (
                    <span key={idx} className="inline-block bg-green-100 px-2 py-1 rounded mr-2 mb-2">{col}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Missing Data Analysis */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">3. Missing Data Analysis</h2>

          {Object.keys(analysis.missingData).length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold">✓ No missing values detected in the dataset</p>
            </div>
          ) : (
            <>
              <p className="text-gray-700 mb-4">
                The following variables contain missing values that require treatment before modeling:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Variable</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Missing Count</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Missing %</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Recommended Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis.missingData).map(([col, stats]) => (
                      <tr key={col} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 font-medium">{col}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{stats.count}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{stats.percentage}%</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {parseFloat(stats.percentage) < 5 ? 'Mean/Median Imputation' :
                            parseFloat(stats.percentage) < 30 ? 'Advanced Imputation (KNN/MICE)' :
                              'Consider Removal or Flag as Missing'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Section 4: Key Findings */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">4. Key Findings and Risk Indicators</h2>

          {/* Numerical Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Descriptive Statistics (Sample):</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Variable</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Count</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Mean</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Median</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Min</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analysis.numStats).slice(0, 10).map(([col, stats]) => (
                    <tr key={col} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 font-medium">{col}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{stats.count}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{stats.mean}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{stats.median}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{stats.min}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">{stats.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Correlations */}
          {analysis.correlations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Significant Correlations:</h3>
              <div className="space-y-2">
                {analysis.correlations.map((corr, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">{corr.col1} ↔ {corr.col2}</span>
                      <span className={`font-bold px-3 py-1 rounded ${Math.abs(corr.corr) > 0.7 ? 'bg-red-100 text-red-700' :
                          Math.abs(corr.corr) > 0.5 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                        }`}>
                        r = {corr.corr}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categorical Distribution */}
          {Object.keys(analysis.catStats).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Categorical Variable Distribution (Top Categories):</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analysis.catStats).slice(0, 4).map(([col, freq]) => (
                  <div key={col} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-800 mb-2">{col}</p>
                    <div className="space-y-1">
                      {freq.map(([val, count], idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600 truncate mr-2">{String(val).substring(0, 30)}</span>
                          <span className="font-medium text-gray-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 5: AI Usage */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">5. AI & GenAI Usage</h2>
          <p className="text-gray-700 mb-4">
            This analysis utilized AI-powered automated statistical analysis and pattern detection.
            The following approaches were employed:
          </p>
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 mb-4">
            <p className="font-semibold text-indigo-900 mb-2">Example AI Prompts Used:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>"Analyze the dataset structure and identify key variables with their data types"</li>
              <li>"Calculate descriptive statistics for all numerical variables"</li>
              <li>"Identify correlations between numerical variables that exceed 0.3 threshold"</li>
              <li>"Detect missing data patterns and recommend appropriate imputation strategies"</li>
              <li>"Analyze categorical variable distributions for anomaly detection"</li>
            </ul>
          </div>
        </section>

        {/* Section 6: Conclusion */}
        <section className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b-2 border-indigo-200 pb-2">6. Conclusion & Next Steps</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Key Findings Summary:</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>Dataset contains {analysis.recordCount.toLocaleString()} records with {analysis.columns.length} variables</li>
                <li>Identified {analysis.numericColumns.length} numerical and {analysis.categoricalColumns.length} categorical features</li>
                <li>Missing data detected in {Object.keys(analysis.missingData).length} variable(s), requiring treatment</li>
                <li>Found {analysis.correlations.length} significant correlations between variables</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Recommended Next Steps:</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
                <li>Address missing data using recommended imputation strategies</li>
                <li>Perform feature engineering based on identified correlations</li>
                <li>Conduct outlier detection and treatment for numerical variables</li>
                <li>Encode categorical variables for model compatibility</li>
                <li>Split data into training and testing sets</li>
                <li>Begin predictive model development using identified risk indicators</li>
              </ol>
            </div>
          </div>
        </section>

        <footer className="text-center text-gray-500 text-sm mt-8">
          <p>Report Generated: {new Date().toLocaleDateString()}</p>
        </footer>
      </div>
    </div>
  );
};

export default EDAAnalyzer;