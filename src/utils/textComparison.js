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
        console.log('Starting mutual document comparison...');
        
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

        console.log('Documents differ, performing mutual comparison...');
        
        // Perform comprehensive mutual comparison
        const result = performComprehensiveMutualComparison(leftHtml, rightHtml);
        console.log('Mutual comparison completed successfully');
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

// Comprehensive mutual comparison that highlights all differences in both documents
const performComprehensiveMutualComparison = (leftHtml, rightHtml) => {
  const leftDiv = htmlToDiv(leftHtml);
  const rightDiv = htmlToDiv(rightHtml);

  // Extract all structural elements for comparison
  const leftElements = extractStructuralElements(leftDiv);
  const rightElements = extractStructuralElements(rightDiv);

  console.log(`Comparing ${leftElements.length} vs ${rightElements.length} elements`);

  // Perform element-by-element mutual comparison
  const { leftProcessed, rightProcessed, summary } = performElementMutualComparison(leftElements, rightElements);

  // Apply the processed content back to the divs
  applyMutualHighlighting(leftDiv, leftProcessed, 'left');
  applyMutualHighlighting(rightDiv, rightProcessed, 'right');

  const detailed = generateDetailedMutualReport(leftElements, rightElements);

  return {
    leftDiffs: [{ type: "equal", content: leftDiv.innerHTML }],
    rightDiffs: [{ type: "equal", content: rightDiv.innerHTML }],
    summary,
    detailed
  };
};

// Extract all structural elements (paragraphs, headings, tables, images, etc.)
const extractStructuralElements = (container) => {
  const elements = [];
  
  // Get all block-level elements and important inline elements
  const selectors = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'div', 'table', 'tr', 'td', 'th', 
    'ul', 'ol', 'li', 'blockquote', 
    'img', 'figure', 'section', 'article'
  ];
  
  const allElements = container.querySelectorAll(selectors.join(','));
  
  allElements.forEach((element, index) => {
    // Skip nested elements to avoid duplication
    const isNested = selectors.some(selector => {
      const parent = element.closest(selector);
      return parent && parent !== element && Array.from(allElements).includes(parent);
    });
    
    if (isNested && element.tagName.toLowerCase() !== 'img') {
      return;
    }
    
    const text = (element.textContent || '').trim();
    const html = element.outerHTML || '';
    const tagName = element.tagName.toLowerCase();
    
    // Capture computed styles for format preservation
    const computedStyle = window.getComputedStyle(element);
    const preservedStyles = {
      fontFamily: computedStyle.fontFamily,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      textAlign: computedStyle.textAlign,
      lineHeight: computedStyle.lineHeight,
      margin: computedStyle.margin,
      padding: computedStyle.padding,
      border: computedStyle.border,
      width: computedStyle.width,
      height: computedStyle.height
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
      preservedStyles,
      originalElement: element
    });
  });
  
  return elements;
};

// Perform comprehensive element-by-element mutual comparison
const performElementMutualComparison = (leftElements, rightElements) => {
  const leftProcessed = [];
  const rightProcessed = [];
  let additions = 0, deletions = 0, modifications = 0;

  // Create alignment matrix for optimal matching
  const alignment = createOptimalAlignment(leftElements, rightElements);
  
  alignment.forEach(({ leftIndex, rightIndex, matchType }) => {
    const leftElement = leftIndex !== null ? leftElements[leftIndex] : null;
    const rightElement = rightIndex !== null ? rightElements[rightIndex] : null;
    
    if (matchType === 'match') {
      // Elements match - check for content differences
      if (leftElement && rightElement) {
        if (areElementsIdentical(leftElement, rightElement)) {
          // Identical - no highlighting
          leftProcessed.push({ ...leftElement, highlight: 'none' });
          rightProcessed.push({ ...rightElement, highlight: 'none' });
        } else {
          // Content differs - apply word-level highlighting
          const { leftHighlighted, rightHighlighted } = performWordLevelMutualDiff(
            leftElement.html, 
            rightElement.html,
            leftElement.preservedStyles
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
      // Element only in left (removed)
      leftProcessed.push({ ...leftElement, highlight: 'removed' });
      rightProcessed.push(createMutualPlaceholder(leftElement, 'removed'));
      deletions++;
    } else if (matchType === 'rightOnly') {
      // Element only in right (added)
      leftProcessed.push(createMutualPlaceholder(rightElement, 'added'));
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

// Create optimal alignment between elements for mutual comparison
const createOptimalAlignment = (leftElements, rightElements) => {
  const alignment = [];
  const leftUsed = new Set();
  const rightUsed = new Set();
  
  // First pass: exact matches
  leftElements.forEach((leftEl, leftIndex) => {
    rightElements.forEach((rightEl, rightIndex) => {
      if (leftUsed.has(leftIndex) || rightUsed.has(rightIndex)) return;
      
      if (areElementsIdentical(leftEl, rightEl)) {
        alignment.push({ leftIndex, rightIndex, matchType: 'match' });
        leftUsed.add(leftIndex);
        rightUsed.add(rightIndex);
      }
    });
  });
  
  // Second pass: similar content matches
  leftElements.forEach((leftEl, leftIndex) => {
    if (leftUsed.has(leftIndex)) return;
    
    rightElements.forEach((rightEl, rightIndex) => {
      if (rightUsed.has(rightIndex)) return;
      
      if (areElementsSimilar(leftEl, rightEl)) {
        alignment.push({ leftIndex, rightIndex, matchType: 'match' });
        leftUsed.add(leftIndex);
        rightUsed.add(rightIndex);
      }
    });
  });
  
  // Third pass: add unmatched elements
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
    const aPos = a.leftIndex !== null ? a.leftIndex : a.rightIndex + 1000;
    const bPos = b.leftIndex !== null ? b.leftIndex : b.rightIndex + 1000;
    return aPos - bPos;
  });
};

// Create placeholder element that maintains original formatting and dimensions
const createMutualPlaceholder = (originalElement, changeType) => {
  const placeholder = {
    element: null,
    text: '',
    html: '',
    isEmpty: true,
    highlight: changeType === 'added' ? 'placeholder-added' : 'placeholder-removed',
    placeholderFor: originalElement,
    tagName: originalElement.tagName,
    preservedStyles: originalElement.preservedStyles,
    isImage: originalElement.isImage,
    isTable: originalElement.isTable,
    isTableRow: originalElement.isTableRow,
    isTableCell: originalElement.isTableCell
  };
  
  return placeholder;
};

// Apply mutual highlighting to document while preserving all original formatting
const applyMutualHighlighting = (container, processedElements, side) => {
  // Clear existing content
  container.innerHTML = '';
  
  processedElements.forEach(element => {
    let newElement;
    
    if (element.element) {
      // Use original element with preserved formatting
      newElement = element.element.cloneNode(true);
    } else if (element.placeholderFor) {
      // Create placeholder that matches original element's dimensions and type
      newElement = createFormattedPlaceholder(element.placeholderFor, element.highlight);
    } else {
      // Fallback element
      newElement = document.createElement(element.tagName || 'div');
    }
    
    // Apply highlighting without affecting original formatting
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
        // Placeholder is already created with proper styling
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

// Create formatted placeholder that maintains original element's visual space
const createFormattedPlaceholder = (originalElement, highlightType) => {
  const placeholder = document.createElement(originalElement.tagName);
  
  // Apply original styles to maintain exact dimensions
  Object.entries(originalElement.preservedStyles).forEach(([property, value]) => {
    if (value && value !== 'auto' && value !== 'normal') {
      placeholder.style[property] = value;
    }
  });
  
  // Set appropriate placeholder content based on element type
  if (originalElement.isImage) {
    placeholder.style.minHeight = '100px';
    placeholder.style.border = '2px dashed';
    placeholder.style.borderRadius = '8px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2';
    placeholder.style.borderColor = highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444';
    placeholder.innerHTML = `<span style="color: ${highlightType === 'placeholder-added' ? '#166534' : '#991b1b'}; font-style: italic; font-size: 14px;">[${highlightType === 'placeholder-added' ? 'Image Added' : 'Image Removed'}]</span>`;
  } else if (originalElement.isTable) {
    placeholder.style.minHeight = '60px';
    placeholder.style.border = '2px dashed';
    placeholder.style.borderRadius = '8px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.backgroundColor = highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2';
    placeholder.style.borderColor = highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444';
    placeholder.innerHTML = `<span style="color: ${highlightType === 'placeholder-added' ? '#166534' : '#991b1b'}; font-style: italic; font-size: 14px;">[${highlightType === 'placeholder-added' ? 'Table Added' : 'Table Removed'}]</span>`;
  } else {
    // Text element placeholder
    const previewText = originalElement.text.substring(0, 100) + (originalElement.text.length > 100 ? '...' : '');
    placeholder.style.minHeight = '1.5em';
    placeholder.style.padding = '8px 12px';
    placeholder.style.border = '2px dashed';
    placeholder.style.borderRadius = '6px';
    placeholder.style.backgroundColor = highlightType === 'placeholder-added' ? '#f0fdf4' : '#fef2f2';
    placeholder.style.borderColor = highlightType === 'placeholder-added' ? '#22c55e' : '#ef4444';
    placeholder.innerHTML = `<span style="color: ${highlightType === 'placeholder-added' ? '#166534' : '#991b1b'}; font-style: italic; opacity: 0.8;">[${highlightType === 'placeholder-added' ? 'Content Added' : 'Content Removed'}: "${previewText}"]</span>`;
  }
  
  placeholder.classList.add('mutual-placeholder', highlightType);
  return placeholder;
};

// Perform word-level mutual diff that preserves original formatting
const performWordLevelMutualDiff = (leftHtml, rightHtml, preservedStyles) => {
  // Extract text content for comparison
  const leftText = extractPlainText(leftHtml);
  const rightText = extractPlainText(rightHtml);
  
  if (leftText === rightText) {
    return { leftHighlighted: leftHtml, rightHighlighted: rightHtml };
  }
  
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  
  // Apply highlighting while preserving original HTML structure
  const leftHighlighted = applyMutualDiffToHtml(leftHtml, diffs, 'left', preservedStyles);
  const rightHighlighted = applyMutualDiffToHtml(rightHtml, diffs, 'right', preservedStyles);
  
  return { leftHighlighted, rightHighlighted };
};

// Apply diff highlighting to HTML while preserving all original formatting
const applyMutualDiffToHtml = (originalHtml, diffs, side, preservedStyles) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Get the text content and create a mapping of text positions to DOM nodes
  const textNodes = [];
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.trim()) {
      textNodes.push(node);
    }
  }
  
  // Apply highlighting based on diffs
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
      // Show actual change
      const highlightClass = operation === 1 ? 'mutual-inline-added' : 'mutual-inline-removed';
      insertHighlightedText(text, highlightClass, preservedStyles);
      if (operation === 1) textOffset += text.length;
    } else {
      // Show placeholder for opposite side
      const placeholderClass = operation === 1 ? 'mutual-inline-placeholder-added' : 'mutual-inline-placeholder-removed';
      insertPlaceholderText(text, placeholderClass, preservedStyles);
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
  
  function insertHighlightedText(text, className, styles) {
    if (currentNodeIndex < textNodes.length) {
      const node = textNodes[currentNodeIndex];
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      
      // Preserve original formatting
      Object.entries(styles).forEach(([property, value]) => {
        if (value && value !== 'auto' && value !== 'normal') {
          span.style[property] = value;
        }
      });
      
      node.parentNode.insertBefore(span, node.nextSibling);
    }
  }
  
  function insertPlaceholderText(text, className, styles) {
    if (currentNodeIndex < textNodes.length) {
      const node = textNodes[currentNodeIndex];
      const span = document.createElement('span');
      span.className = className;
      span.innerHTML = `<em style="opacity: 0.7; font-size: 0.9em;">[${text.substring(0, 30)}${text.length > 30 ? '...' : ''}]</em>`;
      
      // Preserve original formatting for placeholder
      Object.entries(styles).forEach(([property, value]) => {
        if (value && value !== 'auto' && value !== 'normal') {
          span.style[property] = value;
        }
      });
      
      node.parentNode.insertBefore(span, node.nextSibling);
    }
  }
  
  return tempDiv.innerHTML;
};

// Element comparison functions
const areElementsIdentical = (el1, el2) => {
  if (!el1 || !el2) return false;
  if (el1.tagName !== el2.tagName) return false;
  
  // For images, compare src attributes
  if (el1.isImage && el2.isImage) {
    const src1 = el1.element.getAttribute('src') || '';
    const src2 = el2.element.getAttribute('src') || '';
    return src1 === src2;
  }
  
  // For text content, normalize and compare
  const text1 = el1.text.replace(/\s+/g, ' ').trim();
  const text2 = el2.text.replace(/\s+/g, ' ').trim();
  return text1 === text2;
};

const areElementsSimilar = (el1, el2) => {
  if (!el1 || !el2) return false;
  if (el1.tagName !== el2.tagName) return false;
  
  // For images, they're either identical or not similar
  if (el1.isImage || el2.isImage) return false;
  
  // Calculate text similarity
  const similarity = getTextSimilarity(el1.text, el2.text);
  return similarity > 0.6; // 60% similarity threshold
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

// Generate detailed report for mutual comparison
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
        if (areElementsIdentical(leftEl, rightEl)) {
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
            formatChanges: ["Content modified with mutual highlighting"]
          });
        }
        
        // Track table and image changes
        if (leftEl.isTable || rightEl.isTable) {
          tables.push({
            status: areElementsIdentical(leftEl, rightEl) ? "UNCHANGED" : "MODIFIED",
            table: i + 1
          });
        }
        
        if (leftEl.isImage || rightEl.isImage) {
          images.push({
            status: areElementsIdentical(leftEl, rightEl) ? "UNCHANGED" : "MODIFIED",
            index: i + 1
          });
        }
      } else if (leftEl && !rightEl) {
        lines.push({
          v1: String(i + 1),
          v2: "",
          status: "REMOVED",
          diffHtml: `<span class="mutual-inline-removed">${escapeHtml(leftEl.text)}</span>`,
          formatChanges: ["Element removed - placeholder shown in modified document"]
        });
        
        if (leftEl.isTable) tables.push({ status: "REMOVED", table: i + 1 });
        if (leftEl.isImage) images.push({ status: "REMOVED", index: i + 1 });
      } else if (!leftEl && rightEl) {
        lines.push({
          v1: "",
          v2: String(i + 1),
          status: "ADDED",
          diffHtml: `<span class="mutual-inline-added">${escapeHtml(rightEl.text)}</span>`,
          formatChanges: ["Element added - placeholder shown in original document"]
        });
        
        if (rightEl.isTable) tables.push({ status: "ADDED", table: i + 1 });
        if (rightEl.isImage) images.push({ status: "ADDED", index: i + 1 });
      }
    }

    return { lines, tables, images };
  } catch (error) {
    console.error('Error generating mutual detailed report:', error);
    return { lines: [], tables: [], images: [] };
  }
};

// Create inline diff for mutual comparison
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