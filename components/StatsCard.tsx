import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'orange';
  subtext?: string;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, subtext }) => {
  return (
    <div className={`p-6 rounded-xl border ${colorMap[color]} bg-white shadow-sm flex items-start space-x-4`}>
      <div className={`p-3 rounded-lg ${colorMap[color]} bg-opacity-20`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
    </div>
  );
};
