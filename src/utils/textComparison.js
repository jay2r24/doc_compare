import { diffChars, diffWordsWithSpace, diffArrays, diffSentences } from "diff";
import { diff_match_patch } from 'diff-match-patch';

export const compareDocuments = (leftText, rightText) => {
  const diffs = diffChars(leftText, rightText);
  const leftDiffs = [];
  const rightDiffs = [];
  let summary = { additions: 0, deletions: 0, changes: 0 };

  diffs.forEach((diff) => {
    if (diff.added) {
      rightDiffs.push({ type: "insert", content: diff.value });
      summary.additions++;
    } else if (diff.removed) {
      leftDiffs.push({ type: "delete", content: diff.value });
      summary.deletions++;
    } else {
      leftDiffs.push({ type: "equal", content: diff.value });
      rightDiffs.push({ type: "equal", content: diff.value });
    }
  });

  summary.changes = summary.additions + summary.deletions;
  return { leftDiffs, rightDiffs, summary };
};

export const compareHtmlDocuments = (leftHtml, rightHtml) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        console.log('Starting format-preserving document comparison...');
        
        const leftText = extractPlainText(leftHtml);
        const rightText = extractPlainText(rightHtml);

        if (leftText.trim() === rightText.trim()) {
          console.log('Documents are identical');
          resolve({
            leftDiffs: [{ type: "equal", content: leftHtml }],
            rightDiffs: [{ type: "equal", content: rightHtml }],
            summary: { additions: 0, deletions: 0, changes: 0 },
            detailed: { lines: [], tables: [], images: [] }
          });
          return;
        }

        console.log('Documents differ, performing format-preserving comparison...');
        
        const result = performFormatPreservingComparison(leftHtml, rightHtml);
        console.log('Format-preserving comparison completed');
        resolve(result);
        
      } catch (error) {
        console.error("Error during document comparison:", error);
        resolve({
          leftDiffs: [{ type: "equal", content: leftHtml }],
          rightDiffs: [{ type: "equal", content: rightHtml }],
          summary: { additions: 0, deletions: 0, changes: 0 },
          detailed: { lines: [], tables: [], images: [] },
        });
      }
    }, 10);
  });
};

// Enhanced format-preserving comparison that maintains exact Word formatting
const performFormatPreservingComparison = (leftHtml, rightHtml) => {
  // Create working copies that preserve all original formatting
  const leftContainer = createFormattedContainer(leftHtml);
  const rightContainer = createFormattedContainer(rightHtml);

  // Extract semantic elements while preserving their exact formatting
  const leftElements = extractFormattedElements(leftContainer);
  const rightElements = extractFormattedElements(rightContainer);

  console.log(`Comparing ${leftElements.length} vs ${rightElements.length} formatted elements`);

  // Perform element-level comparison with format preservation
  const { leftProcessed, rightProcessed, summary } = performElementComparison(leftElements, rightElements);

  // Apply highlighting while preserving original formatting
  const leftResult = applyFormattingPreservingHighlights(leftContainer, leftProcessed);
  const rightResult = applyFormattingPreservingHighlights(rightContainer, rightProcessed);

  const detailed = generateFormattedDetailedReport(leftElements, rightElements);

  return {
    leftDiffs: [{ type: "equal", content: leftResult }],
    rightDiffs: [{ type: "equal", content: rightResult }],
    summary,
    detailed
  };
};

// Create container that preserves all Word formatting
const createFormattedContainer = (html) => {
  const container = document.createElement('div');
  container.className = 'word-document-preview';
  
  try {
    container.innerHTML = html;
    
    // Ensure all elements maintain their original styling
    const allElements = container.querySelectorAll('*');
    allElements.forEach(element => {
      // Preserve computed styles by copying them to inline styles
      const computedStyle = window.getComputedStyle(element);
      
      // Key formatting properties to preserve
      const preserveProps = [
        'font-family', 'font-size', 'font-weight', 'font-style',
        'color', 'background-color', 'text-align', 'text-decoration',
        'line-height', 'letter-spacing', 'word-spacing',
        'margin', 'padding', 'border', 'width', 'height'
      ];
      
      preserveProps.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'initial' && value !== 'normal') {
          element.style.setProperty(prop, value, 'important');
        }
      });
    });
    
  } catch (error) {
    console.warn('Error creating formatted container:', error);
    container.innerHTML = html;
  }
  
  return container;
};

// Extract elements while preserving their complete formatting context
const extractFormattedElements = (container) => {
  const elements = [];
  
  // Get all meaningful content elements
  const contentElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div');
  
  contentElements.forEach((element, index) => {
    // Skip nested elements to avoid duplication
    if (element.closest('table') && element.tagName.toLowerCase() !== 'td' && element.tagName.toLowerCase() !== 'th') {
      return;
    }
    
    if (element.querySelector('p, h1, h2, h3, h4, h5, h6, li') && !['td', 'th'].includes(element.tagName.toLowerCase())) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    const outerHTML = element.outerHTML;
    const innerHTML = element.innerHTML;
    
    // Capture complete formatting context
    const formattingContext = {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      style: element.getAttribute('style') || '',
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      computedStyles: captureComputedStyles(element)
    };
    
    elements.push({
      element,
      text,
      innerHTML,
      outerHTML,
      index,
      isEmpty: !text,
      formattingContext,
      uniqueId: `element-${index}-${Date.now()}`
    });
  });
  
  return elements;
};

// Capture essential computed styles for format preservation
const captureComputedStyles = (element) => {
  try {
    const computed = window.getComputedStyle(element);
    return {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      textAlign: computed.textAlign,
      lineHeight: computed.lineHeight,
      margin: computed.margin,
      padding: computed.padding,
      border: computed.border
    };
  } catch (error) {
    console.warn('Error capturing computed styles:', error);
    return {};
  }
};

// Perform element-level comparison preserving formatting
const performElementComparison = (leftElements, rightElements) => {
  const leftProcessed = [];
  const rightProcessed = [];
  let additions = 0, deletions = 0;

  const maxElements = Math.max(leftElements.length, rightElements.length);
  
  for (let i = 0; i < maxElements; i++) {
    const leftElement = leftElements[i];
    const rightElement = rightElements[i];
    
    if (leftElement && rightElement) {
      if (leftElement.isEmpty && rightElement.isEmpty) {
        // Both empty - preserve as-is
        leftProcessed.push({ ...leftElement, highlight: 'none' });
        rightProcessed.push({ ...rightElement, highlight: 'none' });
      } else if (leftElement.isEmpty && !rightElement.isEmpty) {
        // Addition
        leftProcessed.push({ 
          ...leftElement, 
          highlight: 'placeholder-added',
          placeholderContent: rightElement.text,
          placeholderFormatting: rightElement.formattingContext
        });
        rightProcessed.push({ ...rightElement, highlight: 'added' });
        additions++;
      } else if (!leftElement.isEmpty && rightElement.isEmpty) {
        // Deletion
        leftProcessed.push({ ...leftElement, highlight: 'removed' });
        rightProcessed.push({ 
          ...rightElement, 
          highlight: 'placeholder-removed',
          placeholderContent: leftElement.text,
          placeholderFormatting: leftElement.formattingContext
        });
        deletions++;
      } else if (areTextsEqual(leftElement.text, rightElement.text)) {
        // Same content - check for formatting changes
        const hasFormatChanges = hasFormattingDifferences(leftElement, rightElement);
        if (hasFormatChanges) {
          leftProcessed.push({ ...leftElement, highlight: 'format-changed' });
          rightProcessed.push({ ...rightElement, highlight: 'format-changed' });
          additions++;
        } else {
          leftProcessed.push({ ...leftElement, highlight: 'none' });
          rightProcessed.push({ ...rightElement, highlight: 'none' });
        }
      } else {
        // Content modified - preserve formatting while highlighting differences
        const { leftHighlighted, rightHighlighted } = performInlineWordDiff(
          leftElement.innerHTML, 
          rightElement.innerHTML,
          leftElement.formattingContext,
          rightElement.formattingContext
        );
        
        leftProcessed.push({ 
          ...leftElement, 
          highlight: 'modified',
          processedContent: leftHighlighted 
        });
        rightProcessed.push({ 
          ...rightElement, 
          highlight: 'modified',
          processedContent: rightHighlighted 
        });
        additions++;
        deletions++;
      }
    } else if (leftElement && !rightElement) {
      // Only left exists - removal
      leftProcessed.push({ ...leftElement, highlight: 'removed' });
      rightProcessed.push(createPlaceholderElement(leftElement, 'removed'));
      deletions++;
    } else if (!leftElement && rightElement) {
      // Only right exists - addition
      leftProcessed.push(createPlaceholderElement(rightElement, 'added'));
      rightProcessed.push({ ...rightElement, highlight: 'added' });
      additions++;
    }
  }

  return {
    leftProcessed,
    rightProcessed,
    summary: { additions, deletions, changes: additions + deletions }
  };
};

// Create placeholder element that maintains formatting context
const createPlaceholderElement = (sourceElement, type) => {
  return {
    element: null,
    text: '',
    innerHTML: '',
    outerHTML: '',
    index: -1,
    isEmpty: true,
    highlight: `placeholder-${type}`,
    placeholderContent: sourceElement.text,
    placeholderFormatting: sourceElement.formattingContext,
    formattingContext: sourceElement.formattingContext,
    uniqueId: `placeholder-${type}-${Date.now()}`
  };
};

// Check for formatting differences between elements
const hasFormattingDifferences = (leftElement, rightElement) => {
  const leftStyles = leftElement.formattingContext.computedStyles;
  const rightStyles = rightElement.formattingContext.computedStyles;
  
  const keyProps = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textAlign'];
  
  return keyProps.some(prop => leftStyles[prop] !== rightStyles[prop]);
};

// Perform word-level diff while preserving HTML formatting
const performInlineWordDiff = (leftHtml, rightHtml, leftFormatting, rightFormatting) => {
  // Extract text for comparison while preserving HTML structure
  const leftText = extractTextPreservingStructure(leftHtml);
  const rightText = extractTextPreservingStructure(rightHtml);
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  
  // Apply highlighting while preserving original HTML structure
  const leftHighlighted = applyInlineHighlighting(leftHtml, diffs, 'left', leftFormatting);
  const rightHighlighted = applyInlineHighlighting(rightHtml, diffs, 'right', rightFormatting);
  
  return { leftHighlighted, rightHighlighted };
};

// Extract text while preserving HTML structure markers
const extractTextPreservingStructure = (html) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Replace HTML tags with markers to preserve structure during diff
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let text = '';
  let node;
  while (node = walker.nextNode()) {
    text += node.textContent;
  }
  
  return text;
};

// Apply highlighting while preserving original HTML structure
const applyInlineHighlighting = (originalHtml, diffs, side, formatting) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Find all text nodes and apply highlighting
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.trim()) {
      textNodes.push(node);
    }
  }
  
  // Apply diff highlighting to text nodes while preserving HTML structure
  let diffIndex = 0;
  let textOffset = 0;
  
  textNodes.forEach(textNode => {
    const nodeText = textNode.textContent;
    const nodeLength = nodeText.length;
    
    let newContent = '';
    let currentOffset = 0;
    
    // Process diffs that overlap with this text node
    while (diffIndex < diffs.length && textOffset < textOffset + nodeLength) {
      const [operation, diffText] = diffs[diffIndex];
      const diffLength = diffText.length;
      
      if (textOffset + diffLength <= textOffset + currentOffset) {
        diffIndex++;
        continue;
      }
      
      const startInNode = Math.max(0, textOffset - (textOffset + currentOffset));
      const endInNode = Math.min(nodeLength, startInNode + diffLength);
      const nodeSegment = nodeText.substring(startInNode, endInNode);
      
      if (operation === 0) {
        // Unchanged text - preserve exactly
        newContent += nodeSegment;
      } else if (operation === 1) {
        // Added text
        if (side === 'right') {
          newContent += `<span class="diff-highlight-added" style="background-color: #dcfce7; color: #166534; padding: 1px 2px; border-radius: 2px; font-family: inherit; font-size: inherit; font-weight: inherit;">${escapeHtml(nodeSegment)}</span>`;
        } else {
          // Show placeholder in left document
          newContent += `<span class="diff-placeholder-added" style="background-color: #f0fdf4; color: #22c55e; font-style: italic; opacity: 0.7; padding: 1px 3px; border-radius: 2px; font-family: inherit; font-size: inherit;">[+${escapeHtml(nodeSegment)}]</span>`;
        }
      } else if (operation === -1) {
        // Removed text
        if (side === 'left') {
          newContent += `<span class="diff-highlight-removed" style="background-color: #fecaca; color: #991b1b; padding: 1px 2px; border-radius: 2px; text-decoration: line-through; font-family: inherit; font-size: inherit; font-weight: inherit;">${escapeHtml(nodeSegment)}</span>`;
        } else {
          // Show placeholder in right document
          newContent += `<span class="diff-placeholder-removed" style="background-color: #fef2f2; color: #ef4444; font-style: italic; opacity: 0.7; padding: 1px 3px; border-radius: 2px; font-family: inherit; font-size: inherit;">[-${escapeHtml(nodeSegment)}]</span>`;
        }
      }
      
      currentOffset = endInNode;
      if (currentOffset >= nodeLength) {
        diffIndex++;
        textOffset += diffLength;
      }
    }
    
    // Replace text node content while preserving parent formatting
    if (newContent !== nodeText) {
      const span = document.createElement('span');
      span.innerHTML = newContent;
      
      // Copy all formatting from parent to ensure preservation
      const parent = textNode.parentElement;
      if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        span.style.fontFamily = parentStyle.fontFamily;
        span.style.fontSize = parentStyle.fontSize;
        span.style.fontWeight = parentStyle.fontWeight;
        span.style.fontStyle = parentStyle.fontStyle;
        span.style.color = parentStyle.color;
        span.style.lineHeight = parentStyle.lineHeight;
        span.style.letterSpacing = parentStyle.letterSpacing;
        span.style.wordSpacing = parentStyle.wordSpacing;
      }
      
      textNode.parentNode.replaceChild(span, textNode);
    }
  });
  
  return tempDiv.innerHTML;
};

// Apply highlighting while preserving exact Word formatting
const applyFormattingPreservingHighlights = (container, processedElements) => {
  // Create a new container to avoid modifying the original
  const resultContainer = container.cloneNode(true);
  
  // Clear and rebuild with highlighted content
  const contentElements = resultContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div');
  
  processedElements.forEach((processedElement, index) => {
    const targetElement = contentElements[index];
    if (!targetElement) return;
    
    // Preserve all original formatting attributes
    const originalStyle = targetElement.getAttribute('style') || '';
    const originalClass = targetElement.getAttribute('class') || '';
    
    switch (processedElement.highlight) {
      case 'added':
        // Add subtle highlight while preserving original formatting
        targetElement.style.cssText = originalStyle + '; background-color: #f0fdf4 !important; border-left: 3px solid #22c55e !important; padding-left: 8px !important; margin: 2px 0 !important; border-radius: 4px !important;';
        targetElement.className = originalClass + ' git-element-added';
        if (processedElement.processedContent) {
          targetElement.innerHTML = processedElement.processedContent;
        }
        break;
        
      case 'removed':
        targetElement.style.cssText = originalStyle + '; background-color: #fef2f2 !important; border-left: 3px solid #ef4444 !important; padding-left: 8px !important; margin: 2px 0 !important; border-radius: 4px !important;';
        targetElement.className = originalClass + ' git-element-removed';
        if (processedElement.processedContent) {
          targetElement.innerHTML = processedElement.processedContent;
        }
        break;
        
      case 'modified':
        targetElement.style.cssText = originalStyle + '; background-color: #fffbeb !important; border-left: 3px solid #f59e0b !important; padding-left: 8px !important; margin: 2px 0 !important; border-radius: 4px !important;';
        targetElement.className = originalClass + ' git-element-modified';
        if (processedElement.processedContent) {
          targetElement.innerHTML = processedElement.processedContent;
        }
        break;
        
      case 'placeholder-added':
        // Create placeholder that matches original element's formatting
        const addedPlaceholder = createFormattedPlaceholder(
          processedElement.placeholderContent,
          processedElement.placeholderFormatting,
          'added'
        );
        targetElement.outerHTML = addedPlaceholder;
        break;
        
      case 'placeholder-removed':
        // Create placeholder that matches original element's formatting
        const removedPlaceholder = createFormattedPlaceholder(
          processedElement.placeholderContent,
          processedElement.placeholderFormatting,
          'removed'
        );
        targetElement.outerHTML = removedPlaceholder;
        break;
        
      case 'format-changed':
        targetElement.style.cssText = originalStyle + '; outline: 2px solid #8b5cf6 !important; outline-offset: 2px !important; background-color: #faf5ff !important;';
        targetElement.className = originalClass + ' git-element-format-changed';
        break;
        
      default:
        // No highlighting - preserve original formatting exactly
        if (processedElement.processedContent) {
          targetElement.innerHTML = processedElement.processedContent;
        }
    }
  });
  
  return resultContainer.innerHTML;
};

// Create formatted placeholder that matches original element styling
const createFormattedPlaceholder = (content, formatting, type) => {
  const tagName = formatting.tagName || 'div';
  const originalStyle = formatting.style || '';
  const originalClass = formatting.className || '';
  
  const placeholderStyle = type === 'added' 
    ? 'background-color: #f0fdf4 !important; border: 2px dashed #22c55e !important; color: #166534 !important;'
    : 'background-color: #fef2f2 !important; border: 2px dashed #ef4444 !important; color: #991b1b !important;';
  
  const combinedStyle = originalStyle + '; ' + placeholderStyle + ' padding: 8px 12px !important; margin: 4px 0 !important; border-radius: 6px !important; font-style: italic !important; opacity: 0.8 !important;';
  
  const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
  const placeholderText = type === 'added' 
    ? `[Content added: "${truncatedContent}"]`
    : `[Content removed: "${truncatedContent}"]`;
  
  return `<${tagName} class="${originalClass} git-placeholder-${type}" style="${combinedStyle}">${escapeHtml(placeholderText)}</${tagName}>`;
};

// Text similarity and equality functions
const getTextSimilarity = (text1, text2) => {
  if (!text1 && !text2) return 1;
  if (!text1 || !text2) return 0;
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(text1, text2);
  
  let totalLength = Math.max(text1.length, text2.length);
  let unchangedLength = 0;
  
  diffs.forEach(diff => {
    if (diff[0] === 0) {
      unchangedLength += diff[1].length;
    }
  });
  
  return totalLength > 0 ? unchangedLength / totalLength : 0;
};

const areTextsEqual = (text1, text2) => {
  const normalize = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(text1) === normalize(text2);
};

const htmlToDiv = (html) => {
  if (!html) return document.createElement("div");
  
  const d = document.createElement("div");
  try {
    d.innerHTML = html;
  } catch (error) {
    console.warn('Error parsing HTML:', error);
  }
  return d;
};

const extractPlainText = (html) => {
  if (!html) return "";
  
  const tempDiv = document.createElement("div");
  try {
    tempDiv.innerHTML = html;
  } catch (error) {
    console.warn('Error extracting plain text:', error);
    return "";
  }
  return tempDiv.textContent || "";
};

export const renderHtmlDifferences = (diffs) => {
  return diffs.map((d) => d.content).join("");
};

export const highlightDifferences = (diffs) => {
  return diffs
    .map((diff) => {
      switch (diff.type) {
        case "insert":
          return `<span class=\"diff-insert\">${escapeHtml(
            diff.content
          )}</span>`;
        case "delete":
          return `<span class=\"diff-delete\">${escapeHtml(
            diff.content
          )}</span>`;
        default:
          return escapeHtml(diff.content);
      }
    })
    .join("");
};

const escapeHtml = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// Generate detailed report with formatting preservation
export const generateFormattedDetailedReport = (leftElements, rightElements) => {
  try {
    const lines = [];
    const maxElements = Math.max(leftElements.length, rightElements.length);
    
    for (let i = 0; i < maxElements; i++) {
      const leftElement = leftElements[i];
      const rightElement = rightElements[i];
      
      if (leftElement && rightElement) {
        if (areTextsEqual(leftElement.text, rightElement.text)) {
          const formatChanges = hasFormattingDifferences(leftElement, rightElement) 
            ? ["Formatting modified"] 
            : [];
          
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: formatChanges.length > 0 ? "FORMATTING-ONLY" : "UNCHANGED",
            diffHtml: escapeHtml(leftElement.text),
            formatChanges
          });
        } else {
          const diffHtml = createFormattedInlineDiff(leftElement.text, rightElement.text);
          const formatChanges = hasFormattingDifferences(leftElement, rightElement) 
            ? ["Content and formatting modified"] 
            : ["Content modified"];
          
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: "MODIFIED",
            diffHtml,
            formatChanges
          });
        }
      } else if (leftElement && !rightElement) {
        lines.push({
          v1: String(i + 1),
          v2: "",
          status: "REMOVED",
          diffHtml: `<span class="diff-highlight-removed">${escapeHtml(leftElement.text)}</span>`,
          formatChanges: ["Element removed"]
        });
      } else if (!leftElement && rightElement) {
        lines.push({
          v1: "",
          v2: String(i + 1),
          status: "ADDED",
          diffHtml: `<span class="diff-highlight-added">${escapeHtml(rightElement.text)}</span>`,
          formatChanges: ["Element added"]
        });
      }
    }

    return { lines, tables: [], images: [] };
  } catch (error) {
    console.error('Error generating formatted detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};

// Create inline diff with formatting preservation
const createFormattedInlineDiff = (leftText, rightText) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const escaped = escapeHtml(text);
    
    if (operation === 1) return `<span class="diff-highlight-added" style="background-color: #dcfce7; color: #166534; padding: 1px 2px; border-radius: 2px; font-family: inherit; font-size: inherit; font-weight: inherit;">${escaped}</span>`;
    if (operation === -1) return `<span class="diff-highlight-removed" style="background-color: #fecaca; color: #991b1b; padding: 1px 2px; border-radius: 2px; text-decoration: line-through; font-family: inherit; font-size: inherit; font-weight: inherit;">${escaped}</span>`;
    return escaped;
  }).join("");
};