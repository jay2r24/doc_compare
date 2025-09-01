import React, { useEffect, useRef } from 'react';
import { renderHtmlDifferences } from '../utils/textComparison';

const DocumentPreview = ({ document, diffs, title, containerId }) => {
  const contentRef = useRef(null);
  const containerRef = useRef(null);

  const content = diffs ? renderHtmlDifferences(diffs) : document.originalHtmlContent;

  // Handle scroll synchronization between containers
  useEffect(() => {
    if (!containerRef.current || !containerId) return;

    const container = containerRef.current;
    let isScrolling = false;

    const handleScroll = (e) => {
      if (isScrolling) return;
      
      const sourceContainer = e.target;
      const sourceId = sourceContainer.id;
      
      // Determine the target container ID
      const targetId = sourceId.includes('left') 
        ? sourceId.replace('left', 'right') 
        : sourceId.replace('right', 'left');
      const targetContainer = document.getElementById(targetId);
      
      if (targetContainer && targetContainer !== sourceContainer) {
        // Calculate scroll ratio
        const sourceMaxScroll = Math.max(1, sourceContainer.scrollHeight - sourceContainer.clientHeight);
        const targetMaxScroll = Math.max(1, targetContainer.scrollHeight - targetContainer.clientHeight);
        
        const scrollRatio = sourceContainer.scrollTop / sourceMaxScroll;
        const targetScrollTop = Math.round(targetMaxScroll * scrollRatio);
        
        // Prevent infinite loop
        isScrolling = true;
        targetContainer.scrollTop = targetScrollTop;
        
        // Reset flag after a short delay
        setTimeout(() => {
          isScrolling = false;
        }, 50);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerId]);

  // Auto-scale content to fit container width while preserving proportions
  useEffect(() => {
    if (!contentRef.current || !containerRef.current || !content) return;

    const adjustScale = () => {
      try {
      const content = contentRef.current;
      const container = containerRef.current;
      
      if (!content || !container) return;
      
      // Reset transform to measure natural size
      content.style.transform = 'none';
      content.style.width = 'auto';
      
      // Measure content and container
      const contentWidth = content.scrollWidth;
      const containerWidth = container.clientWidth - 32; // Account for padding
      
      if (contentWidth > containerWidth) {
        const scale = containerWidth / contentWidth;
        content.style.transform = `scale(${scale})`;
        content.style.transformOrigin = 'top left';
        content.style.width = `${100 / scale}%`;
        
        // Adjust container height to account for scaling
        const scaledHeight = content.scrollHeight * scale;
        content.style.height = `${content.scrollHeight}px`;
      } else {
        content.style.transform = 'none';
        content.style.width = '100%';
        content.style.height = 'auto';
      }
      } catch (error) {
        console.warn('Error adjusting document scale:', error);
      }
    };

    // Adjust scale after content loads and on resize
    const timer = setTimeout(adjustScale, 200);
    
    const resizeObserver = new ResizeObserver(adjustScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [content]);

  // Ensure Word document formatting is preserved after comparison
  useEffect(() => {
    if (!contentRef.current || !content) return;
    
    // Apply format preservation after content is rendered
    const preserveWordFormatting = () => {
      const container = contentRef.current;
      if (!container) return;
      
      // Ensure all Word document elements maintain their original styling
      const wordElements = container.querySelectorAll('*');
      wordElements.forEach(element => {
        // Preserve original Word document styling
        if (element.style.fontFamily) {
          element.style.setProperty('font-family', element.style.fontFamily, 'important');
        }
        if (element.style.fontSize) {
          element.style.setProperty('font-size', element.style.fontSize, 'important');
        }
        if (element.style.fontWeight) {
          element.style.setProperty('font-weight', element.style.fontWeight, 'important');
        }
        if (element.style.color) {
          element.style.setProperty('color', element.style.color, 'important');
        }
        if (element.style.lineHeight) {
          element.style.setProperty('line-height', element.style.lineHeight, 'important');
        }
        if (element.style.textAlign) {
          element.style.setProperty('text-align', element.style.textAlign, 'important');
        }
      });
    };
    
    // Apply preservation immediately and after any DOM changes
    const timer = setTimeout(preserveWordFormatting, 100);
    
    const observer = new MutationObserver(preserveWordFormatting);
    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [content]);

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-sm"></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 truncate">
              {title}
            </h3>
            <p className="text-sm text-gray-600 truncate mt-0.5" title={document.name}>
              📄 {document.name}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="flex-1 overflow-auto bg-white" 
        id={containerId} 
        ref={containerRef}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="p-4">
          <div 
            ref={contentRef}
            className="word-document-preview bg-white shadow-sm border border-gray-100 rounded-lg p-6"
            dangerouslySetInnerHTML={{ __html: content || '' }}
            style={{ 
              minHeight: '100%',
              transition: 'transform 0.2s ease-out'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;