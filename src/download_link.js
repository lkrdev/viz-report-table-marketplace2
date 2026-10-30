const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(str) {
  return escapeHtmlText(str).replace(/"/g, "&quot;");
}

function extractCellText(node) {
  if (!node) return "";
  if (node.nodeType === 3) return node.nodeValue || "";
  const cl = node.classList;
  if (node.nodeType !== 1 || (cl && (cl.contains("row-collapse-icon") || cl.contains("sort-icon") || cl.contains("sort-num")))) {
    return "";
  }
  return Array.from(node.childNodes || [], extractCellText).join("");
}

function serializeElementWithInlineStyles(
  element,
  props,
  options = {},
) {
  if (!element || element.nodeType !== 1) return "";

  const tag = element.tagName.toLowerCase();
  if (tag === "tr" && options && options.excludeHiddenRows) {
    const inlineDisplay = element.style?.display;
    let isHidden = inlineDisplay === "none";
    if (!isHidden && typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      isHidden = window.getComputedStyle(element).display === "none";
    }
    if (isHidden) {
      return "";
    }
    const rowPath = element.getAttribute("data-subtotal-path") || "";
    if (
      rowPath.indexOf("(Expand ") !== -1 ||
      (element.textContent && /\(Expand\s+.*\.\.\.\)/.test(element.textContent))
    ) {
      return "";
    }
  }

  const isCell = tag === "td" || tag === "th";
  const styleMap = new Map();
  const existingInlineStyle = element.getAttribute("style") || "";
  if (existingInlineStyle) {
    existingInlineStyle.split(";").forEach((part) => {
      const idx = part.indexOf(":");
      if (idx > 0) {
        styleMap.set(part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim());
      }
    });
  }

  let valign = "";
  let computedPaddingLeft = "";
  if (isCell && typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const cs = window.getComputedStyle(element);
    for (let i = 0; i < props.length; i++) {
      const key = props[i];
      let val = cs.getPropertyValue(key);
      if (key === "text-decoration" && val && val.indexOf("underline") > -1) {
        val = "underline";
      }
      if (key === "vertical-align" && val) {
        valign = val;
      }
      if (key === "padding-left" && val) {
        computedPaddingLeft = val;
      }
      if (val) {
        styleMap.set(key, val);
      }
    }
  }

  let childIndentPrefix = "";
  if (tag === "td") {
    const pVal = element.style?.paddingLeft || computedPaddingLeft || "";
    const px = parseInt(pVal, 10);
    // ponytail: 15px threshold skips 4-8px theme cell padding; singleIndex uses 15px and hierarchy uses 16px*depth
    if (!isNaN(px) && px >= 15) {
      const indentLevel = Math.max(1, Math.round(px / 16));
      childIndentPrefix = "\u200B" + "\u00A0\u00A0\u00A0\u00A0".repeat(indentLevel);
      styleMap.set("padding-left", pVal);
      styleMap.set("text-indent", `${indentLevel * 16}px`);
    }
  }

  const combinedStyle = Array.from(styleMap, ([k, v]) => `${k}: ${v}`).join("; ");

  let attrStr = "";
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name === "style" || attr.name === "valign") continue;
      attrStr += ` ${attr.name}="${escapeHtmlAttr(attr.value)}"`;
    }
  }
  const elementValign = element.getAttribute("valign");
  if (valign || elementValign) {
    attrStr += ` valign="${escapeHtmlAttr(valign || elementValign)}"`;
  }
  if (combinedStyle) {
    attrStr += ` style="${escapeHtmlAttr(combinedStyle)}"`;
  }

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrStr}>`;
  }

  if (isCell) {
    return `<${tag}${attrStr}>${childIndentPrefix}${escapeHtmlText(extractCellText(element))}</${tag}>`;
  }

  const childrenHtml = Array.from(element.childNodes || [], (c) =>
    serializeElementWithInlineStyles(c, props, options),
  ).join("");

  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

export function getTableExcelDataUrl(targetElement, options = {}) {
  const props = [
    "font-size",
    "color",
    "text-align",
    "border",
    "vertical-align",
    "font-style",
    "font-weight",
    "background-color",
    "text-decoration",
    "padding-left",
    "border-bottom",
    "border-top",
    "border-left",
    "border-right",
  ];

  let tbl = targetElement;
  if (typeof tbl === 'string' && typeof document !== 'undefined') {
    tbl = document.querySelector(tbl);
  }
  if (!tbl && typeof document !== 'undefined') {
    tbl = document.getElementById("reportTable");
  } else if (tbl && tbl.id !== "reportTable") {
    tbl = tbl.querySelector("#reportTable") || tbl;
  }

  if (!tbl) {
    console.error("Table element with id 'reportTable' not found");
    return null;
  }

  const tableHtml = serializeElementWithInlineStyles(tbl, props, options);

  const text =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<meta http-equiv=Content-Type content="text/html; charset=utf-8"><body>' +
    '<meta name=Generator content="Microsoft Excel 15">' +
    tableHtml +
    '</body></html>';

  return "data:application/vnd.ms-excel," + encodeURIComponent(text);
}

// Alternative function that doesn't require setShowDownload callback
export async function downloadTableAsExcel(targetElement, options = {}) {
  const url = getTableExcelDataUrl(targetElement, options);
  if (!url) return;
  const text = decodeURIComponent(url.replace("data:application/vnd.ms-excel,", ""));
  const filename = `table${new Date().toISOString()}.xls`;

  setTimeout(() => {
    try {
      const ref = window.open("about:blank", "_blank");
      if (ref && ref.document && ref.document.body) {
        const downloadref = ref.document.createElement("a");
        downloadref.href = url;
        downloadref.download = filename;
        ref.document.body.appendChild(downloadref);
        downloadref.click();
        ref.close();
        return;
      }
    } catch (error) {
      console.error("Error clicking download link:", error);
    }

    // Fallback for sandboxed extension iframes where window.open is blocked or returns null
    if (typeof document === "undefined" || !document.body) return;
    let href = url;
    let objectUrl = null;
    try {
      if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        objectUrl = URL.createObjectURL(
          new Blob([text], { type: "application/vnd.ms-excel;charset=utf-8" }),
        );
        href = objectUrl;
      }
      const downloadref = document.createElement("a");
      downloadref.href = href;
      downloadref.download = filename;
      document.body.appendChild(downloadref);
      downloadref.click();
      document.body.removeChild(downloadref);
    } catch {
      // ignore fallback errors
    } finally {
      if (objectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  }, 500);
}