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
        console.log('Starting exact mutual document comparison...');
        
        // Quick text comparison first
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

        console.log('Documents differ, performing exact mutual comparison...');
        
        // Perform exact mutual comparison with space preservation
        const result = performExactMutualComparison(leftHtml, rightHtml);
        console.log('Exact mutual comparison completed successfully');
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

// Exact mutual comparison that preserves all spacing and dimensions
const performExactMutualComparison = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  // Extract all elements with exact positioning and dimensions
  const leftElements = extractElementsWithDimensions(leftDiv);
  const rightElements = extractElementsWithDimensions(rightDiv);

  console.log(`Comparing ${leftElements.length} vs ${rightElements.length} elements with exact dimensions`);

  // Perform exact element-by-element mutual comparison
  const { leftProcessed, rightProcessed, summary } = performExactElementComparison(leftElements, rightElements);

  // Apply the processed content back to the divs with exact spacing
  applyExactMutualHighlighting(leftDiv, leftProcessed, 'left');
  applyExactMutualHighlighting(rightDiv, rightProcessed, 'right');

  const detailed = generateDetailedMutualReport(leftElements, rightElements);

  return {
    leftDiffs: [{ type: "equal", content: leftDiv.innerHTML }],
    rightDiffs: [{ type: "equal", content: rightDiv.innerHTML }],
    summary,
    detailed
  };
};

// Extract all elements with their exact dimensions and positioning
const extractElementsWithDimensions = (container) => {
  const elements = [];
  
  // Get all meaningful elements including text nodes
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'div', 'table', 'tr', 'td', 'th', 
    'ul', 'ol', 'li', 'blockquote', 
    'img', 'figure', 'section', 'article',
    'span', 'strong', 'em', 'b', 'i'
  ];
  
  const allElements = container.querySelectorAll(selectors.join(','));
  
  allElements.forEach((element, index) => {
    // Skip nested elements to avoid duplication, except for important inline elements
    const isImportantInline = ['img', 'span', 'strong', 'em', 'b', 'i'].includes(element.tagName.toLowerCase());
    const isNested = !isImportantInline && selectors.some(selector => {
      const parent = element.closest(selector);
      return parent && parent !== element && Array.from(allElements).includes(parent);
    });
    
    if (isNested) {
      return;
    }
    
    const text = (element.textContent || '').trim();
    const html = element.outerHTML || '';
    const tagName = element.tagName.toLowerCase();
    
    // Capture exact computed styles and dimensions
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    const exactDimensions = {
      width: rect.width,
      height: rect.height,
      offsetTop: element.offsetTop,
      offsetLeft: element.offsetLeft,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth
    };
    
    const preservedStyles = {
      // Typography
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      lineHeight: computedStyle.lineHeight,
      letterSpacing: computedStyle.letterSpacing,
      wordSpacing: computedStyle.wordSpacing,
      textAlign: computedStyle.textAlign,
      textIndent: computedStyle.textIndent,
      textDecoration: computedStyle.textDecoration,
      textTransform: computedStyle.textTransform,
      
      // Colors
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      
      // Spacing and layout
      margin: computedStyle.margin,
      marginTop: computedStyle.marginTop,
      marginRight: computedStyle.marginRight,
      marginBottom: computedStyle.marginBottom,
      marginLeft: computedStyle.marginLeft,
      padding: computedStyle.padding,
      paddingTop: computedStyle.paddingTop,
      paddingRight: computedStyle.paddingRight,
      paddingBottom: computedStyle.paddingBottom,
      paddingLeft: computedStyle.paddingLeft,
      
      // Borders
      border: computedStyle.border,
      borderTop: computedStyle.borderTop,
      borderRight: computedStyle.borderRight,
      borderBottom: computedStyle.borderBottom,
      borderLeft: computedStyle.borderLeft,
      borderRadius: computedStyle.borderRadius,
      
      // Dimensions
      width: computedStyle.width,
      height: computedStyle.height,
      minWidth: computedStyle.minWidth,
      minHeight: computedStyle.minHeight,
      maxWidth: computedStyle.maxWidth,
      maxHeight: computedStyle.maxHeight,
      
      // Display and positioning
      display: computedStyle.display,
      position: computedStyle.position,
      top: computedStyle.top,
      right: computedStyle.right,
      bottom: computedStyle.bottom,
      left: computedStyle.left,
      zIndex: computedStyle.zIndex,
      
      // Flexbox and grid
      flexDirection: computedStyle.flexDirection,
      flexWrap: computedStyle.flexWrap,
      justifyContent: computedStyle.justifyContent,
      alignItems: computedStyle.alignItems,
      alignContent: computedStyle.alignContent,
      
      // Table specific
      borderCollapse: computedStyle.borderCollapse,
      borderSpacing: computedStyle.borderSpacing,
      tableLayout: computedStyle.tableLayout,
      
      // Other important properties
      overflow: computedStyle.overflow,
      overflowX: computedStyle.overflowX,
      overflowY: computedStyle.overflowY,
      whiteSpace: computedStyle.whiteSpace,
      wordWrap: computedStyle.wordWrap,
      wordBreak: computedStyle.wordBreak,
      verticalAlign: computedStyle.verticalAlign
    };
    
    elements.push({
      element: element.cloneNode(true),
      text,
      html,
      index,
      tagName,
      isEmpty: !text && tagName !== 'img',
      isImage: tagName === 'img',
      isTable: tagName === 'table',
      isTableRow: tagName === 'tr',
      isTableCell: tagName === 'td' || tagName === 'th',
      isHeading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName),
      isParagraph: tagName === 'p',
      isList: tagName === 'ul' || tagName === 'ol',
      isListItem: tagName === 'li',
      preservedStyles,
      exactDimensions,
      originalElement: element
    });
  });
  
  return elements;
};

// Perform exact element-by-element mutual comparison with space preservation
const performExactElementComparison = (leftElements, rightElements) => {
  const leftProcessed = [];
  const rightProcessed = [];
  let additions = 0, deletions = 0, modifications = 0;

  // Create exact alignment matrix for optimal matching
  const alignment = createExactAlignment(leftElements, rightElements);
  
  alignment.forEach(({ leftIndex, rightIndex, matchType }) => {
    const leftElement = leftIndex !== null ? leftElements[leftIndex] : null;
    const rightElement = rightIndex !== null ? rightElements[rightIndex] : null;
    
    if (matchType === 'match') {
      // Elements match - check for content differences
      if (leftElement && rightElement) {
        if (areElementsExactlyIdentical(leftElement, rightElement)) {
          // Identical - no highlighting, preserve exact formatting
          leftProcessed.push({ ...leftElement, highlight: 'none' });
          rightProcessed.push({ ...rightElement, highlight: 'none' });
        } else {
          // Content differs - apply word-level highlighting while preserving exact formatting
          const { leftHighlighted, rightHighlighted } = performWordLevelMutualDiff(
            leftElement.html, 
            rightElement.html,
            leftElement.preservedStyles,
            rightElement.preservedStyles
          );
          leftProcessed.push({ 
            ...leftElement, 
            highlight: 'modified',
            mutualHtml: leftHighlighted 
          });
          rightProcessed.push({ 
            ...rightElement, 
            highlight: 'modified',
            mutualHtml: rightHighlighted 
          });
          modifications++;
        }
      }
    } else if (matchType === 'leftOnly') {
      // Element only in left (removed) - show in red in left, placeholder in right
      leftProcessed.push({ ...leftElement, highlight: 'removed' });
      rightProcessed.push(createExactSpacePlaceholder(leftElement, 'removed'));
      deletions++;
    } else if (matchType === 'rightOnly') {
      // Element only in right (added) - placeholder in left, show in green in right
      leftProcessed.push(createExactSpacePlaceholder(rightElement, 'added'));
      rightProcessed.push({ ...rightElement, highlight: 'added' });
      additions++;
    }
  });

  return {
    leftProcessed,
    rightProcessed,
    summary: { 
      additions, 
      deletions, 
      changes: additions + deletions + modifications 
    }
  };
};

// Create exact alignment between elements for mutual comparison
const createExactAlignment = (leftElements, rightElements) => {
  const alignment = [];
  const leftUsed = new Set();
  const rightUsed = new Set();
  
  // First pass: exact matches by content and structure
  leftElements.forEach((leftEl, leftIndex) => {
    rightElements.forEach((rightEl, rightIndex) => {
      if (leftUsed.has(leftIndex) || rightUsed.has(rightIndex)) return;
      
      if (areElementsExactlyIdentical(leftEl, rightEl)) {
        alignment.push({ leftIndex, rightIndex, matchType: 'match' });
        leftUsed.add(leftIndex);
        rightUsed.add(rightIndex);
      }
    });
  });
  
  // Second pass: similar content matches with same structure
  leftElements.forEach((leftEl, leftIndex) => {
    if (leftUsed.has(leftIndex)) return;
    
    rightElements.forEach((rightEl, rightIndex) => {
      if (rightUsed.has(rightIndex)) return;
      
      if (areElementsStructurallySimilar(leftEl, rightEl)) {
        alignment.push({ leftIndex, rightIndex, matchType: 'match' });
        leftUsed.add(leftIndex);
        rightUsed.add(rightIndex);
      }
    });
  });
  
  // Third pass: add unmatched elements in document order
  leftElements.forEach((leftEl, leftIndex) => {
    if (!leftUsed.has(leftIndex)) {
      alignment.push({ leftIndex, rightIndex: null, matchType: 'leftOnly' });
    }
  });
  
  rightElements.forEach((rightEl, rightIndex) => {
    if (!rightUsed.has(rightIndex)) {
      alignment.push({ leftIndex: null, rightIndex, matchType: 'rightOnly' });
    }
  });
  
  // Sort by position to maintain document order
  return alignment.sort((a, b) => {
    const aPos = a.leftIndex !== null ? a.leftIndex : (a.rightIndex + 10000);
    const bPos = b.leftIndex !== null ? b.leftIndex : (b.rightIndex + 10000);
    return aPos - bPos;
  });
};

// Create exact space placeholder that maintains original element's exact dimensions and formatting
const createExactSpacePlaceholder = (originalElement, changeType) => {
  const placeholder = {
    element: null,
    text: '',
    html: '',
    isEmpty: true,
    highlight: changeType === 'added' ? 'placeholder-added' : 'placeholder-removed',
    placeholderFor: originalElement,
    tagName: originalElement.tagName,
    preservedStyles: { ...originalElement.preservedStyles },
    exactDimensions: { ...originalElement.exactDimensions },
    isImage: originalElement.isImage,
    isTable: originalElement.isTable,
    isTableRow: originalElement.isTableRow,
    isTableCell: originalElement.isTableCell,
    isHeading: originalElement.isHeading,
    isParagraph: originalElement.isParagraph,
    isList: originalElement.isList,
    isListItem: originalElement.isListItem
  };
  
  return placeholder;
};

// Apply exact mutual highlighting to document while preserving all original formatting and dimensions
const applyExactMutualHighlighting = (container, processedElements, side) => {
  // Clear existing content
  container.innerHTML = '';
  
  processedElements.forEach(element => {
    let newElement;
    
    if (element.element) {
      // Use original element with preserved formatting
      newElement = element.element.cloneNode(true);
    } else if (element.placeholderFor) {
      // Create exact space placeholder that matches original element's dimensions
      newElement = createExactDimensionPlaceholder(element.placeholderFor, element.highlight);
    } else {
      // Fallback element
      newElement = document.createElement(element.tagName || 'div');
    }
    
    // Apply highlighting without affecting original formatting or dimensions
    switch (element.highlight) {
      case 'added':
        newElement.classList.add('mutual-added');
        if (element.mutualHtml) {
          newElement.innerHTML = element.mutualHtml;
        }
        break;
      case 'removed':
        newElement.classList.add('mutual-removed');
        if (element.mutualHtml) {
          newElement.innerHTML = element.mutualHtml;
        }
        break;
      case 'modified':
        newElement.classList.add('mutual-modified');
        if (element.mutualHtml) {
          newElement.innerHTML = element.mutualHtml;
        }
        break;
      case 'placeholder-added':
      case 'placeholder-removed':
        // Placeholder is already created with exact styling and dimensions
        break;
      default:
        // No highlighting for unchanged content
        if (element.mutualHtml) {
          newElement.innerHTML = element.mutualHtml;
        }
    }
    
    container.appendChild(newElement);
  });
};

// Create exact dimension placeholder that maintains original element's visual space perfectly
const createExactDimensionPlaceholder = (originalElement, highlightType) => {
  const placeholder = document.createElement(originalElement.tagName);
  
  // Apply ALL original styles to maintain exact dimensions and appearance
  Object.entries(originalElement.preservedStyles).forEach(([property, value]) => {
    if (value && value !== 'auto' && value !== 'normal' && value !== 'initial') {
      try {
        placeholder.style.setProperty(property, value, 'important');
      } catch (error) {
        console.warn(`Could not set style property ${property}:`, error);
      }
    }
  });
  
  // Ensure exact dimensions are maintained
  const { exactDimensions } = originalElement;
  if (exactDimensions.height > 0) {
    placeholder.style.setProperty('min-height', `${exactDimensions.height}px`, 'important');
  }
  if (exactDimensions.width > 0) {
    placeholder.style.setProperty('min-width', `${exactDimensions.width}px`, 'important');
  }
  
  // Set appropriate placeholder content based on element type while maintaining exact space
  if (originalElement.isImage) {
    placeholder.style.setProperty('display', 'flex', 'important');
    placeholder.style.setProperty('align-items', 'center', 'important');
    placeholder.style.setProperty('justify-content', 'center', 'important');
    placeholder.style.setProperty('border', '2px dashed', 'important');
    placeholder.style.setProperty('border-radius', '8px', 'important');
    placeholder.style.setProperty('background-color', highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2', 'important');
    placeholder.style.setProperty('border-color', highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444', 'important');
    
    const imageText = document.createElement('span');
    imageText.style.color = highlightType === 'placeholder-added' ? '#166534' : '#991b1b';
    imageText.style.fontStyle = 'italic';
    imageText.style.fontSize = '14px';
    imageText.style.fontFamily = 'system-ui, sans-serif';
    imageText.textContent = `[${highlightType === 'placeholder-added' ? 'Image Added' : 'Image Removed'}]`;
    placeholder.appendChild(imageText);
    
  } else if (originalElement.isTable) {
    placeholder.style.setProperty('display', 'flex', 'important');
    placeholder.style.setProperty('align-items', 'center', 'important');
    placeholder.style.setProperty('justify-content', 'center', 'important');
    placeholder.style.setProperty('border', '2px dashed', 'important');
    placeholder.style.setProperty('border-radius', '8px', 'important');
    placeholder.style.setProperty('background-color', highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2', 'important');
    placeholder.style.setProperty('border-color', highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444', 'important');
    
    const tableText = document.createElement('span');
    tableText.style.color = highlightType === 'placeholder-added' ? '#166534' : '#991b1b';
    tableText.style.fontStyle = 'italic';
    tableText.style.fontSize = '14px';
    tableText.style.fontFamily = 'system-ui, sans-serif';
    tableText.textContent = `[${highlightType === 'placeholder-added' ? 'Table Added' : 'Table Removed'}]`;
    placeholder.appendChild(tableText);
    
  } else {
    // Text element placeholder - maintain exact text formatting and spacing
    const previewText = originalElement.text.substring(0, 50) + (originalElement.text.length > 50 ? '...' : '');
    placeholder.style.setProperty('border', '2px dashed', 'important');
    placeholder.style.setProperty('border-radius', '6px', 'important');
    placeholder.style.setProperty('background-color', highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2', 'important');
    placeholder.style.setProperty('border-color', highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444', 'important');
    
    // Create placeholder text that maintains original formatting
    const placeholderText = document.createElement('span');
    placeholderText.style.color = highlightType === 'placeholder-added' ? '#166534' : '#991b1b';
    placeholderText.style.fontStyle = 'italic';
    placeholderText.style.opacity = '0.8';
    placeholderText.style.fontSize = 'inherit';
    placeholderText.style.fontFamily = 'inherit';
    placeholderText.style.lineHeight = 'inherit';
    placeholderText.textContent = `[${highlightType === 'placeholder-added' ? 'Content Added' : 'Content Removed'}: "${previewText}"]`;
    placeholder.appendChild(placeholderText);
  }
  
  placeholder.classList.add('mutual-placeholder', highlightType);
  return placeholder;
};

// Perform word-level mutual diff that preserves exact original formatting
const performWordLevelMutualDiff = (leftHtml, rightHtml, leftStyles, rightStyles) => {
  // Extract text content for comparison
  const leftText = extractPlainText(leftHtml);
  const rightText = extractPlainText(rightHtml);
  
  if (leftText === rightText) {
    return { leftHighlighted: leftHtml, rightHighlighted: rightHtml };
  }
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  
  // Apply highlighting while preserving exact original HTML structure and formatting
  const leftHighlighted = applyExactMutualDiffToHtml(leftHtml, diffs, 'left', leftStyles);
  const rightHighlighted = applyExactMutualDiffToHtml(rightHtml, diffs, 'right', rightStyles);
  
  return { leftHighlighted, rightHighlighted };
};

// Apply diff highlighting to HTML while preserving ALL original formatting exactly
const applyExactMutualDiffToHtml = (originalHtml, diffs, side, preservedStyles) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Get all text nodes and create exact mapping
  const textNodes = [];
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent && node.textContent.trim()) {
      textNodes.push(node);
    }
  }
  
  // Apply highlighting based on diffs while preserving exact formatting
  let textOffset = 0;
  let currentNodeIndex = 0;
  let currentNodeOffset = 0;
  
  diffs.forEach(diff => {
    const [operation, text] = diff;
    
    if (operation === 0) {
      // Unchanged text - advance position
      textOffset += text.length;
      advanceTextPosition(text.length);
    } else if ((operation === 1 && side === 'right') || (operation === -1 && side === 'left')) {
      // Show actual change with exact formatting preservation
      const highlightClass = operation === 1 ? 'mutual-inline-added' : 'mutual-inline-removed';
      insertHighlightedTextWithExactFormatting(text, highlightClass, preservedStyles);
      if (operation === 1) textOffset += text.length;
    } else {
      // Show placeholder for opposite side with exact spacing
      const placeholderClass = operation === 1 ? 'mutual-inline-placeholder-added' : 'mutual-inline-placeholder-removed';
      insertPlaceholderTextWithExactSpacing(text, placeholderClass, preservedStyles);
    }
  });
  
  function advanceTextPosition(length) {
    let remaining = length;
    while (remaining > 0 && currentNodeIndex < textNodes.length) {
      const node = textNodes[currentNodeIndex];
      const nodeText = node.textContent;
      const availableInNode = nodeText.length - currentNodeOffset;
      
      if (remaining <= availableInNode) {
        currentNodeOffset += remaining;
        remaining = 0;
      } else {
        remaining -= availableInNode;
        currentNodeIndex++;
        currentNodeOffset = 0;
      }
    }
  }
  
  function insertHighlightedTextWithExactFormatting(text, className, styles) {
    if (currentNodeIndex < textNodes.length) {
      const node = textNodes[currentNodeIndex];
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      
      // Preserve ALL original formatting exactly
      Object.entries(styles).forEach(([property, value]) => {
        if (value && value !== 'auto' && value !== 'normal' && value !== 'initial') {
          try {
            span.style.setProperty(property, value, 'important');
          } catch (error) {
            console.warn(`Could not preserve style ${property}:`, error);
          }
        }
      });
      
      node.parentNode.insertBefore(span, node.nextSibling);
    }
  }
  
  function insertPlaceholderTextWithExactSpacing(text, className, styles) {
    if (currentNodeIndex < textNodes.length) {
      const node = textNodes[currentNodeIndex];
      const span = document.createElement('span');
      span.className = className;
      
      // Create placeholder that maintains exact text spacing
      const placeholderContent = document.createElement('em');
      placeholderContent.style.opacity = '0.7';
      placeholderContent.style.fontSize = '0.9em';
      placeholderContent.style.fontStyle = 'italic';
      placeholderContent.style.fontFamily = 'system-ui, sans-serif';
      placeholderContent.textContent = `[${text.substring(0, 30)}${text.length > 30 ? '...' : ''}]`;
      span.appendChild(placeholderContent);
      
      // Preserve original formatting for placeholder container
      Object.entries(styles).forEach(([property, value]) => {
        if (value && value !== 'auto' && value !== 'normal' && value !== 'initial') {
          try {
            span.style.setProperty(property, value, 'important');
          } catch (error) {
            console.warn(`Could not preserve placeholder style ${property}:`, error);
          }
        }
      });
      
      node.parentNode.insertBefore(span, node.nextSibling);
    }
  }
  
  return tempDiv.innerHTML;
};

// Enhanced element comparison functions
const areElementsExactlyIdentical = (el1, el2) => {
  if (!el1 || !el2) return false;
  if (el1.tagName !== el2.tagName) return false;
  
  // For images, compare src attributes and dimensions
  if (el1.isImage && el2.isImage) {
    const src1 = el1.element.getAttribute('src') || '';
    const src2 = el2.element.getAttribute('src') || '';
    const alt1 = el1.element.getAttribute('alt') || '';
    const alt2 = el2.element.getAttribute('alt') || '';
    return src1 === src2 && alt1 === alt2;
  }
  
  // For tables, compare structure and content
  if (el1.isTable && el2.isTable) {
    const table1Html = el1.html.replace(/\s+/g, ' ').trim();
    const table2Html = el2.html.replace(/\s+/g, ' ').trim();
    return table1Html === table2Html;
  }
  
  // For text content, normalize and compare exactly
  const text1 = el1.text.replace(/\s+/g, ' ').trim();
  const text2 = el2.text.replace(/\s+/g, ' ').trim();
  return text1 === text2;
};

const areElementsStructurallySimilar = (el1, el2) => {
  if (!el1 || !el2) return false;
  if (el1.tagName !== el2.tagName) return false;
  
  // For images and tables, they're either identical or not similar
  if (el1.isImage || el2.isImage || el1.isTable || el2.isTable) return false;
  
  // Calculate text similarity for text elements
  const similarity = getTextSimilarity(el1.text, el2.text);
  return similarity > 0.7; // 70% similarity threshold for structural matching
};

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

// Utility functions
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
          return `<span class="diff-insert">${escapeHtml(diff.content)}</span>`;
        case "delete":
          return `<span class="diff-delete">${escapeHtml(diff.content)}</span>`;
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

// Generate detailed report for exact mutual comparison
const generateDetailedMutualReport = (leftElements, rightElements) => {
  try {
    const lines = [];
    const tables = [];
    const images = [];
    
    const maxElements = Math.max(leftElements.length, rightElements.length);
    
    for (let i = 0; i < maxElements; i++) {
      const leftEl = leftElements[i];
      const rightEl = rightElements[i];
      
      if (leftEl && rightEl) {
        if (areElementsExactlyIdentical(leftEl, rightEl)) {
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: "UNCHANGED",
            diffHtml: escapeHtml(leftEl.text),
            formatChanges: []
          });
        } else {
          const diffHtml = createMutualInlineDiff(leftEl.text, rightEl.text);
          lines.push({
            v1: String(i + 1),
            v2: String(i + 1),
            status: "MODIFIED",
            diffHtml,
            formatChanges: ["Content modified with exact spacing preservation"]
          });
        }
        
        // Track table and image changes with exact dimensions
        if (leftEl.isTable || rightEl.isTable) {
          tables.push({
            status: areElementsExactlyIdentical(leftEl, rightEl) ? "UNCHANGED" : "MODIFIED",
            table: i + 1,
            dimensions: leftEl.exactDimensions || rightEl.exactDimensions
          });
        }
        
        if (leftEl.isImage || rightEl.isImage) {
          images.push({
            status: areElementsExactlyIdentical(leftEl, rightEl) ? "UNCHANGED" : "MODIFIED",
            index: i + 1,
            dimensions: leftEl.exactDimensions || rightEl.exactDimensions
          });
        }
      } else if (leftEl && !rightEl) {
        lines.push({
          v1: String(i + 1),
          v2: "",
          status: "REMOVED",
          diffHtml: `<span class="mutual-inline-removed">${escapeHtml(leftEl.text)}</span>`,
          formatChanges: ["Element removed - exact space placeholder shown in modified document"]
        });
        
        if (leftEl.isTable) tables.push({ status: "REMOVED", table: i + 1, dimensions: leftEl.exactDimensions });
        if (leftEl.isImage) images.push({ status: "REMOVED", index: i + 1, dimensions: leftEl.exactDimensions });
      } else if (!leftEl && rightEl) {
        lines.push({
          v1: "",
          v2: String(i + 1),
          status: "ADDED",
          diffHtml: `<span class="mutual-inline-added">${escapeHtml(rightEl.text)}</span>`,
          formatChanges: ["Element added - exact space placeholder shown in original document"]
        });
        
        if (rightEl.isTable) tables.push({ status: "ADDED", table: i + 1, dimensions: rightEl.exactDimensions });
        if (rightEl.isImage) images.push({ status: "ADDED", index: i + 1, dimensions: rightEl.exactDimensions });
      }
    }

    return { lines, tables, images };
  } catch (error) {
    console.error('Error generating exact mutual detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};

// Create inline diff for mutual comparison with exact formatting
const createMutualInlineDiff = (leftText, rightText) => {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText || "", rightText || "");
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(diff => {
    const [operation, text] = diff;
    const escaped = escapeHtml(text);
    
    if (operation === 1) return `<span class="mutual-inline-added">${escaped}</span>`;
    if (operation === -1) return `<span class="mutual-inline-removed">${escaped}</span>`;
    return escaped;
  }).join("");
};