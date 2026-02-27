import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ onSearch, placeholder = 'Search papers...' }) {
  const [value, setValue] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const clear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <div className="relative w-full max-w-2xl">
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
