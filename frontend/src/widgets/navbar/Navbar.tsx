import React from 'react';

interface NavbarProps {
  title: string;
  userName: string | undefined;
  onLogout: () => void;
  onTitleClick: () => void;
}

export function Navbar({ title, userName, onLogout, onTitleClick }: NavbarProps) {
  return (
    <div className="flex-none p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center z-20 shadow-md">
      <div className="flex items-center space-x-3">
        <h1 className="text-xl font-bold text-white tracking-tight cursor-pointer" onClick={onTitleClick}>
          {title}
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        {userName && (
          <>
            <span className="text-sm text-slate-400">Welcome, <span className="text-white font-medium">{userName}</span></span>
            <button onClick={onLogout} className="text-sm text-red-400 hover:text-red-300 transition-colors">Logout</button>
          </>
        )}
      </div>
    </div>
  );
}
