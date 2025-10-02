import React from 'react';

/**
 * SettingsPage: A placeholder for a complex page, loaded dynamically via lazy/Suspense.
 */
const SettingsPage = () => {
  // Simulate heavy processing or complex UI that would make this file large
  return (
    <div className="p-8 bg-yellow-50 rounded-xl border border-yellow-200 shadow-lg">
      <h2 className="text-3xl font-bold text-yellow-800 mb-4">User Settings</h2>
      <p className="text-yellow-600">
        This page was **dynamically imported (Code Split)**. Its code was not loaded until you clicked the navigation link.
      </p>
      <form className="mt-4 space-y-4">
        <label className="block">
          <span className="text-gray-700">Default Currency:</span>
          <input type="text" defaultValue="USD" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
        </label>
        <label className="block">
          <span className="text-gray-700">Notifications:</span>
          <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
            <option>Enabled</option>
            <option>Disabled</option>
          </select>
        </label>
      </form>
    </div>
  );
};

export default SettingsPage;
