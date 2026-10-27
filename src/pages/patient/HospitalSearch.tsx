import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { HospitalSearchResult } from '../../../shared/types.js';
import { 
  Search, 
  MapPin, 
  Clock, 
  Calendar, 
  Filter, 
  X, 
  Sparkles, 
  Building2, 
  ChevronRight,
  ArrowUpDown,
  Stethoscope,
  RefreshCw
} from 'lucide-react';

export const HospitalSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Query states from URL or defaults
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [selectedDept, setSelectedDept] = useState(searchParams.get('department') || 'all');
  const [selectedLocality, setSelectedLocality] = useState(searchParams.get('locality') || 'all');
  const [maxWait, setMaxWait] = useState<number | undefined>(
    searchParams.get('maxWait') ? Number(searchParams.get('maxWait')) : undefined
  );
  const [sortBy, setSortBy] = useState<'wait' | 'name'>(
    (searchParams.get('sort') as any) || 'wait'
  );

  const [hospitals, setHospitals] = useState<HospitalSearchResult[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [localities, setLocalities] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounce search keyword by 300ms to prevent typing jitter and runaway GET requests
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 300);
    return () => clearTimeout(handler);
  }, [keyword]);

  // Load metadata filters on mount
  useEffect(() => {
    Promise.all([api.getDepartments(), api.getLocalities()])
      .then(([depts, locs]) => {
        setDepartments(depts);
        setLocalities(locs);
      })
      .catch(console.error);
  }, []);

  const loadHospitals = (overrideSort?: 'wait' | 'name') => {
    const effectiveSort = overrideSort || sortBy;
    if (hospitals.length === 0) {
      setInitialLoading(true);
    } else {
      setIsUpdating(true);
    }

    api.getHospitals({
      q: debouncedKeyword,
      department: selectedDept,
      locality: selectedLocality,
      maxWait,
      sort: effectiveSort
    })
      .then(res => {
        setHospitals(res);
      })
      .catch(console.error)
      .finally(() => {
        setInitialLoading(false);
        setIsUpdating(false);
      });
  };

  const handleSortChange = (newSort: 'wait' | 'name') => {
    if (sortBy === newSort) return;
    setSortBy(newSort);

    // Instant optimistic sort so cards smoothly rearrange with 0ms visual delay
    setHospitals(prev => {
      const sorted = [...prev];
      if (newSort === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else {
        sorted.sort((a, b) => (a.currentQueueWait || 0) - (b.currentQueueWait || 0));
      }
      return sorted;
    });

    loadHospitals(newSort);
  };

  // Fetch hospitals whenever debounced search or filters change
  useEffect(() => {
    loadHospitals();

    // Guard URL synchronization to prevent cyclic updates
    const currentQ = searchParams.get('q') || '';
    const currentDept = searchParams.get('department') || 'all';
    const currentLoc = searchParams.get('locality') || 'all';
    const currentMaxWait = searchParams.get('maxWait') || '';
    const currentSort = searchParams.get('sort') || 'wait';

    const nextQ = debouncedKeyword || '';
    const nextDept = selectedDept;
    const nextLoc = selectedLocality;
    const nextMaxWait = maxWait ? maxWait.toString() : '';
    const nextSort = sortBy;

    if (
      currentQ !== nextQ ||
      currentDept !== nextDept ||
      currentLoc !== nextLoc ||
      currentMaxWait !== nextMaxWait ||
      currentSort !== nextSort
    ) {
      const params: Record<string, string> = {};
      if (nextQ) params.q = nextQ;
      if (nextDept !== 'all') params.department = nextDept;
      if (nextLoc !== 'all') params.locality = nextLoc;
      if (nextMaxWait) params.maxWait = nextMaxWait;
      if (nextSort !== 'wait') params.sort = nextSort;
      setSearchParams(params, { replace: true });
    }
  }, [debouncedKeyword, selectedDept, selectedLocality, maxWait, sortBy]);

  const clearAllFilters = () => {
    setKeyword('');
    setSelectedDept('all');
    setSelectedLocality('all');
    setMaxWait(undefined);
    setSortBy('wait');
  };

  const hasActiveFilters = Boolean(
    keyword || selectedDept !== 'all' || selectedLocality !== 'all' || maxWait
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Find Hospitals & OPD Queues
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore clinics and hospitals across Ahmedabad & Gandhinagar. Check live queue waiting times before stepping out.
        </p>
      </div>

      {/* Prominent Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-md">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Search by hospital, doctor, area, or symptoms (e.g. fever, cardiology, bones, skin)..."
            className="w-full pl-12 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white transition"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Department dropdown */}
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 border-none font-medium text-slate-700 hover:bg-slate-200 focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              <option value="all">All Specialties</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Locality dropdown */}
            <select
              value={selectedLocality}
              onChange={e => setSelectedLocality(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 border-none font-medium text-slate-700 hover:bg-slate-200 focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              <option value="all">All Localities</option>
              {localities.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            {/* Max Wait filter */}
            <select
              value={maxWait || ''}
              onChange={e => setMaxWait(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 border-none font-medium text-slate-700 hover:bg-slate-200 focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              <option value="">Any Wait Time</option>
              <option value="15">Max 15 mins wait</option>
              <option value="30">Max 30 mins wait</option>
              <option value="45">Max 45 mins wait</option>
            </select>
          </div>

          {/* Sort By selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort:
            </span>
            <button
              onClick={() => handleSortChange('wait')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                sortBy === 'wait' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Shortest Queue
            </button>
            <button
              onClick={() => handleSortChange('name')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                sortBy === 'name' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Name
            </button>
          </div>
        </div>

        {/* Filter chips if active */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400">Active filters:</span>
            {keyword && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                Keyword: "{keyword}"
                <button onClick={() => setKeyword('')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedDept !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
                Specialty: {selectedDept}
                <button onClick={() => setSelectedDept('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedLocality !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
                Locality: {selectedLocality}
                <button onClick={() => setSelectedLocality('all')}><X className="w-3 h-3" /></button>
              </span>
            )}
            {maxWait && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
                Wait ≤ {maxWait}m
                <button onClick={() => setMaxWait(undefined)}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-brand-700 hover:underline font-semibold ml-2"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Results Count & Status + Manual Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 px-1">
        <div className="flex items-center gap-2">
          <span>Showing {hospitals.length} healthcare facilities</span>
          {isUpdating && (
            <span className="inline-flex items-center gap-1 text-[11px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Updating...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></span>
            Dynamic OPD wait times
          </span>
          <button
            onClick={() => loadHospitals()}
            className="text-brand-700 hover:text-brand-800 font-bold flex items-center gap-1 transition"
            title="Refresh hospital wait times"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Live Wait</span>
          </button>
        </div>
      </div>

      {/* Hospital Cards Grid */}
      {initialLoading && hospitals.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading hospital queue availability...
        </div>
      ) : hospitals.length > 0 ? (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-200 ${isUpdating ? 'opacity-85' : 'opacity-100'}`}>
          {hospitals.map(hospital => (
            <div
              key={hospital.id}
              className="bg-white rounded-3xl border border-slate-200 hover:border-brand-400 transition-all shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6">
                {/* Top: Name & Locality */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {hospital.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
                      {hospital.locality}, {hospital.city}
                    </p>
                  </div>

                  {/* Current Estimated Wait Pill */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-bold text-xs shadow-sm">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{hospital.currentQueueWait <= 5 ? 'Walk-in Ready (< 5m)' : `~${hospital.currentQueueWait} mins wait`}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {hospital.waitingCount} patients in OPD
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {hospital.description}
                </p>

                {/* Department Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {hospital.departments.map(dept => (
                    <span
                      key={dept}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium"
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Bar: Next Available Slot + CTA */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Next Available Slot</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-700" />
                    {hospital.nextAvailableSlot}
                  </span>
                </div>

                <Link
                  to={`/hospitals/${hospital.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span>Select & Book</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No matching hospitals found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try adjusting your keyword or clearing filters to view available OPD queues.
          </p>
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-800 transition"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
