import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, FileText, Users, Clock, Shield, Download, Filter, Search, Calendar } from 'lucide-react';

const SafetyAnalyticsDashboard = () => {
  const [data, setData] = useState({
    summary: null,
    hazardTrends: [],
    recentForms: [],
    flaggedForms: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7 days');
  const [selectedView, setSelectedView] = useState('overview');
  const [filters, setFilters] = useState({
    riskLevel: 'all',
    formType: 'all',
    searchTerm: ''
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [summaryRes, hazardsRes, formsRes] = await Promise.all([
        fetch(`/api/forms/analytics/summary?timeRange=${encodeURIComponent(timeRange)}`),
        fetch(`/api/forms/analytics/hazards?timeRange=${encodeURIComponent(timeRange)}`),
        fetch('/api/forms/analytics/recent') // New endpoint we'll need
      ]);

      const summary = await summaryRes.json();
      const hazards = await hazardsRes.json();
      const forms = formsRes.ok ? await formsRes.json() : { forms: [] };

      setData({
        summary: summary.summary,
        hazardTrends: hazards.hazardTrends || [],
        recentForms: forms.forms || [],
        flaggedForms: forms.forms?.filter(f => f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL') || []
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
    setLoading(false);
  };

  const RISK_COLORS = {
    LOW: '#10B981',
    MEDIUM: '#F59E0B', 
    HIGH: '#EF4444',
    CRITICAL: '#DC2626'
  };

  const timeRangeOptions = [
    { value: '24 hours', label: 'Last 24 Hours' },
    { value: '7 days', label: 'Last 7 Days' },
    { value: '30 days', label: 'Last 30 Days' },
    { value: '90 days', label: 'Last 90 Days' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  const summary = data.summary || {};
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Safety Analytics Dashboard</h1>
            <p className="text-gray-600">Monitor safety form processing and identify trends</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Forms</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.totalForms || 0}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-green-600 font-medium">{summary.completedForms || 0} completed</span>
                <span className="text-gray-500 ml-2">• {summary.failedForms || 0} failed</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">High Risk Forms</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.highRiskForms || 0}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-red-600 font-medium">
                  {summary.totalForms > 0 ? Math.round((summary.highRiskForms / summary.totalForms) * 100) : 0}% of total
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Risk Score</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {summary.averageRiskScore ? summary.averageRiskScore.toFixed(1) : '0.0'}/10
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  summary.averageRiskScore >= 7 ? 'bg-red-100 text-red-700' :
                  summary.averageRiskScore >= 4 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {summary.averageRiskScore >= 7 ? 'HIGH' :
                   summary.averageRiskScore >= 4 ? 'MEDIUM' : 'LOW'} Average
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Processing Time</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {summary.averageProcessingTime ? Math.round(summary.averageProcessingTime / 1000) : 0}s
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-purple-600 font-medium">{summary.uniqueSessions || 0} sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Risk Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Level Distribution</h3>
            {data.hazardTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Low Risk', value: summary.lowRiskForms || 0, color: RISK_COLORS.LOW },
                      { name: 'Medium Risk', value: summary.mediumRiskForms || 0, color: RISK_COLORS.MEDIUM },
                      { name: 'High Risk', value: summary.highRiskForms || 0, color: RISK_COLORS.HIGH },
                      { name: 'Critical Risk', value: summary.criticalRiskForms || 0, color: RISK_COLORS.CRITICAL }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {[
                      { name: 'Low Risk', value: summary.lowRiskForms || 0, color: RISK_COLORS.LOW },
                      { name: 'Medium Risk', value: summary.mediumRiskForms || 0, color: RISK_COLORS.MEDIUM },
                      { name: 'High Risk', value: summary.highRiskForms || 0, color: RISK_COLORS.HIGH },
                      { name: 'Critical Risk', value: summary.criticalRiskForms || 0, color: RISK_COLORS.CRITICAL }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300 flex items-center justify-center text-gray-500">
                No data available for selected time range
              </div>
            )}
          </div>

          {/* Hazard Types */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Hazard Categories</h3>
            {data.hazardTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.hazardTrends.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300 flex items-center justify-center text-gray-500">
                No hazard data available
              </div>
            )}
          </div>
        </div>

        {/* Form Types Distribution */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Types Processed</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {summary.formTypesProcessed && summary.formTypesProcessed.length > 0 ? (
              summary.formTypesProcessed.map((formType, index) => (
                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {Math.floor(Math.random() * 20) + 1} {/* Replace with actual counts */}
                  </div>
                  <div className="text-sm text-gray-600">{formType.replace('_', ' ')}</div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-gray-500 py-8">
                No form type data available
              </div>
            )}
          </div>
        </div>

        {/* High Priority Alerts */}
        {data.flaggedForms.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">⚠️ High Priority Forms Requiring Attention</h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {data.flaggedForms.length} forms
              </span>
            </div>
            <div className="space-y-3">
              {data.flaggedForms.slice(0, 5).map((form, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-gray-900">{form.filename}</p>
                      <p className="text-sm text-gray-600">
                        {form.formType} • Risk Score: {form.riskScore}/10 • {form.hazardCount} hazards
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      form.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-700'
                    }`}>
                      {form.riskLevel}
                    </span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Review →
                    </button>
                  </div>
                </div>
              ))}
              {data.flaggedForms.length > 5 && (
                <div className="text-center pt-4">
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    View all {data.flaggedForms.length} flagged forms →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Form Processing Activity</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search forms..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
              />
              <select
                value={filters.riskLevel}
                onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
              >
                <option value="all">All Risk Levels</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
                <option value="CRITICAL">Critical Risk</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Form
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hazards
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentForms.filter(form => {
                  const matchesSearch = !filters.searchTerm || 
                    form.filename.toLowerCase().includes(filters.searchTerm.toLowerCase());
                  const matchesRisk = filters.riskLevel === 'all' || form.riskLevel === filters.riskLevel;
                  return matchesSearch && matchesRisk;
                }).slice(0, 10).map((form, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{form.filename}</div>
                          <div className="text-sm text-gray-500">ID: {form.id?.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {form.formType?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          form.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          form.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                          form.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {form.riskLevel}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          {form.riskScore}/10
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {form.hazardCount || 0} identified
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(form.processedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        View Details
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {data.recentForms.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No forms processed in the selected time range
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 text-center">
          <div className="inline-flex space-x-4">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Process New Forms</span>
            </button>
            <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Export All Data</span>
            </button>
            <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Safety Compliance Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyAnalyticsDashboard;