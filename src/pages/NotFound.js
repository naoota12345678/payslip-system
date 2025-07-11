// src/pages/NotFound.js
import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl mt-4 mb-8">ページが見つかりませんでした</p>
        <Link to="/" className="text-blue-600 hover:underline">
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}

export default NotFound;