import React from 'react';

/**
 * DashboardPage: The main page of the application, loaded immediately.
 */
const DashboardPage = () => {
  return (
    <div className="p-8 bg-white rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">Dashboard</h2>
      <p className="text-gray-600">
        This is your main content area. This module is **statically imported** and loads instantly with the app.
      </p>
      <div className="mt-4 text-sm text-green-600 font-medium">
        (Check the network tab when you switch to Reports or Settings to see the new chunks load!)
      </div>
    </div>
  );
};

export default DashboardPage;
