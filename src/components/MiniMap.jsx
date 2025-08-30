import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

const CHANGE_SELECTORS = [
  '.git-line-added',
  '.git-line-removed', 
  '.git-line-modified',
  '.git-line-placeholder',
  '.git-inline-added',
  '.git-inline-removed',
  '.placeholder-added',
  '.placeholder-removed'
];

const UnifiedMiniMap = ({ leftContainerId, rightContainerId }) => {
  const minimapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const [currentChange, setCurrentChange] = useState(0);

  const getContainers = useCallback(() => ({
    left: document.getElementById(leftContainerId),
    right: document.getElementById(rightContainerId)
  }), [leftContainerId, rightContainerId]);

  const collectUnifiedMarkers = useCallback(() => {
    const { left, right } = getContainers();
    if (!left || !right) return [];

    const allMarkers = [];
    
    // Collect markers from both containers and unify them
    [left, right].forEach((container, containerIndex) => {
      const side = containerIndex === 0 ? 'left' : 'right';
      const elements = container.querySelectorAll(CHANGE_SELECTORS.join(','));
      
      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top + container.scrollTop;
        
        const scrollHeight = Math.max(container.scrollHeight, container.clientHeight);
        const ratio = Math.min(1, Math.max(0, relativeTop / scrollHeight));
        
        // Determine change type and color
        let color = '#6b7280';
        let changeType = 'unknown';
        let priority = 0;
        
        if (element.classList.contains('git-line-added') || 
            element.classList.contains('git-inline-added') ||
            element.classList.contains('placeholder-added')) {
          color = '#10b981';
          changeType = 'added';
          priority = 3;
        } else if (element.classList.contains('git-line-removed') || 
                   element.classList.contains('git-inline-removed') ||
                   element.classList.contains('placeholder-removed')) {
          color = '#ef4444';
          changeType = 'removed';
          priority = 3;
        } else if (element.classList.contains('git-line-modified')) {
          color = '#f59e0b';
          changeType = 'modified';
          priority = 2;
        } else if (element.classList.contains('git-line-placeholder')) {
          color = '#8b5cf6';
          changeType = 'empty-space';
          priority = 4;
        }

        allMarkers.push({
          ratio,
          color,
          changeType,
          side,
          element,
          elementTop: relativeTop,
          priority
        });
      });
    });

    // Sort by position and deduplicate nearby markers, keeping highest priority
    const sorted = allMarkers.sort((a, b) => a.ratio - b.ratio);
    const unified = [];
    const threshold = 0.01;
    
    sorted.forEach((marker) => {
      const existing = unified.find(m => Math.abs(m.ratio - marker.ratio) <= threshold);
      if (!existing) {
        unified.push({
          ...marker,
          unified: true,
          elements: [marker.element]
        });
      } else if (marker.priority > existing.priority) {
        // Replace with higher priority marker
        const index = unified.indexOf(existing);
        unified[index] = {
          ...marker,
          unified: true,
          elements: [existing.element, marker.element]
        };
      } else {
        // Add element to existing marker
        existing.elements.push(marker.element);
      }
    });

    return unified;
  }, [getContainers]);

  const updateViewport = useCallback(() => {
    const { left } = getContainers();
    if (!left) return;
    
    const scrollTop = left.scrollTop;
    const clientHeight = left.clientHeight;
    const scrollHeight = left.scrollHeight;
    
    if (scrollHeight <= clientHeight) {
      setViewport({ top: 0, height: 100 });
      return;
    }
    
    const topPercentage = (scrollTop / scrollHeight) * 100;
    const heightPercentage = (clientHeight / scrollHeight) * 100;
    
    setViewport({ 
      top: Math.min(100 - heightPercentage, topPercentage), 
      height: heightPercentage 
    });
  }, [getContainers]);

  const scrollToRatio = useCallback((targetRatio) => {
    const { left, right } = getContainers();
    if (!left || !right) return;

    const leftMaxScroll = Math.max(0, left.scrollHeight - left.clientHeight);
    const rightMaxScroll = Math.max(0, right.scrollHeight - right.clientHeight);
    
    const leftScrollTop = Math.round(leftMaxScroll * targetRatio);
    const rightScrollTop = Math.round(rightMaxScroll * targetRatio);

    left.scrollTo({ top: leftScrollTop, behavior: 'smooth' });
    right.scrollTo({ top: rightScrollTop, behavior: 'smooth' });
  }, [getContainers]);

  const scrollToElement = useCallback((elements) => {
    if (!elements || elements.length === 0) return;
    
    // Use the first element for navigation
    const element = elements[0];
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    
    // Highlight all related elements
    elements.forEach(el => {
      const originalBoxShadow = el.style.boxShadow;
      const originalTransition = el.style.transition;
      
      el.style.transition = 'box-shadow 0.3s ease';
      el.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.3)';
      
      setTimeout(() => {
        el.style.boxShadow = originalBoxShadow;
        setTimeout(() => {
          el.style.transition = originalTransition;
        }, 300);
      }, 1500);
    });
  }, []);

  const handleMinimapClick = useCallback((e) => {
    if (!minimapRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = minimapRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.min(1, Math.max(0, clickY / rect.height));
    
    const closestMarker = markers.reduce((closest, marker) => {
      const distance = Math.abs(marker.ratio - clickRatio);
      if (!closest || distance < closest.distance) {
        return { marker, distance };
      }
      return closest;
    }, null);
    
    if (closestMarker && closestMarker.distance < 0.03) {
      scrollToElement(closestMarker.marker.elements);
      setCurrentChange(markers.indexOf(closestMarker.marker));
    } else {
      scrollToRatio(clickRatio);
    }
  }, [markers, scrollToRatio, scrollToElement]);

  const navigateToNext = useCallback(() => {
    if (markers.length === 0) return;
    
    const nextIndex = (currentChange + 1) % markers.length;
    setCurrentChange(nextIndex);
    scrollToElement(markers[nextIndex].elements);
  }, [markers, currentChange, scrollToElement]);

  const navigateToPrevious = useCallback(() => {
    if (markers.length === 0) return;
    
    const prevIndex = currentChange === 0 ? markers.length - 1 : currentChange - 1;
    setCurrentChange(prevIndex);
    scrollToElement(markers[prevIndex].elements);
  }, [markers, currentChange, scrollToElement]);

  const resetView = useCallback(() => {
    const { left, right } = getContainers();
    if (!left || !right) return;
    
    left.scrollTo({ top: 0, behavior: 'smooth' });
    right.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentChange(0);
  }, [getContainers]);

  // Initialize and refresh markers
  useEffect(() => {
    const refreshAll = () => {
      setMarkers(collectUnifiedMarkers());
      updateViewport();
    };

    const initialTimer = setTimeout(refreshAll, 500);
    
    const { left, right } = getContainers();
    if (!left || !right) return () => clearTimeout(initialTimer);

    const handleScroll = () => {
      updateViewport();
    };

    const handleContentChange = () => {
      clearTimeout(window.minimapContentTimer);
      window.minimapContentTimer = setTimeout(refreshAll, 200);
    };

    left.addEventListener('scroll', handleScroll, { passive: true });
    right.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new MutationObserver(handleContentChange);
    observer.observe(left, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'style'],
      characterData: true 
    });
    observer.observe(right, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'style'],
      characterData: true 
    });

    const handleResize = () => {
      clearTimeout(window.minimapResizeTimer);
      window.minimapResizeTimer = setTimeout(refreshAll, 300);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(window.minimapContentTimer);
      clearTimeout(window.minimapResizeTimer);
      
      left.removeEventListener('scroll', handleScroll);
      right.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [collectUnifiedMarkers, updateViewport, getContainers]);

  // Group markers by type for legend
  const markersByType = markers.reduce((acc, marker) => {
    acc[marker.changeType] = (acc[marker.changeType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Navigation Controls */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-600">
            Unified Changes ({markers.length})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={navigateToPrevious}
              disabled={markers.length === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous change"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <span className="text-xs text-gray-500 min-w-[40px] text-center">
              {markers.length > 0 ? `${currentChange + 1}/${markers.length}` : '0/0'}
            </span>
            <button
              onClick={navigateToNext}
              disabled={markers.length === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next change"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              onClick={resetView}
              className="p-1 rounded hover:bg-gray-200 transition-colors ml-1"
              title="Reset to top"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Minimap */}
      <div className="p-3">
        <div 
          ref={minimapRef}
          onClick={handleMinimapClick}
          className="relative w-full h-48 bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 cursor-pointer overflow-hidden transition-all duration-200 hover:border-blue-300 hover:shadow-md"
          title="Unified document changes • Click to navigate"
        >
          {/* Background grid */}
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i}
                className="absolute left-0 right-0 border-t border-gray-300"
                style={{ top: `${(i + 1) * 12.5}%` }}
              />
            ))}
          </div>
          
          {/* Unified change markers */}
          {markers.map((marker, i) => (
            <div 
              key={`unified-${i}`}
              className={`absolute transition-all duration-200 hover:scale-110 cursor-pointer z-20 rounded-sm ${
                i === currentChange ? 'ring-2 ring-blue-500 ring-offset-1' : ''
              }`}
              style={{ 
                left: '4px',
                right: '4px',
                top: `${marker.ratio * 100}%`, 
                height: marker.changeType === 'empty-space' ? '6px' : '4px',
                backgroundColor: marker.color,
                opacity: 0.85,
                boxShadow: `0 1px 3px ${marker.color}40`
              }}
              title={`${marker.changeType} change - click to navigate`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollToElement(marker.elements);
                setCurrentChange(i);
              }}
            />
          ))}
          
          {/* Viewport indicator */}
          <div
            className="absolute left-0 right-0 border-2 border-blue-500 bg-blue-400/20 rounded-sm transition-all duration-300 pointer-events-none z-30"
            style={{ 
              top: `${viewport.top}%`, 
              height: `${Math.max(3, viewport.height)}%`,
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          />
          
          {/* No changes message */}
          {markers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="text-xs text-gray-400 text-center bg-white/80 px-3 py-2 rounded-lg">
                No changes detected
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs font-medium text-gray-600 mb-2">Change Types</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {markersByType.added > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-green-500 rounded-sm"></div>
              <span className="text-gray-600">Added ({markersByType.added})</span>
            </div>
          )}
          {markersByType.removed > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-red-500 rounded-sm"></div>
              <span className="text-gray-600">Removed ({markersByType.removed})</span>
            </div>
          )}
          {markersByType.modified > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-yellow-500 rounded-sm"></div>
              <span className="text-gray-600">Modified ({markersByType.modified})</span>
            </div>
          )}
          {markersByType['empty-space'] > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-purple-500 rounded-sm"></div>
              <span className="text-gray-600">Empty Space ({markersByType['empty-space']})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedMiniMap;