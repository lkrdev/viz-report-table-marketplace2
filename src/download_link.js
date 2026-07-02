export function getTableExcelDataUrl(targetElement) {
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

  const copy_tbl = tbl.cloneNode(true);
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    computedStyleToInlineStyle(copy_tbl, { recursive: true, properties: props });
  }

  const text =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<meta http-equiv=Content-Type content="text/html; charset=utf-8"><body>' +
    '<meta name=Generator content="Microsoft Excel 15">' +
    copy_tbl.outerHTML +
    '</body></html>';

  return "data:application/vnd.ms-excel," + encodeURIComponent(text);
}

// Alternative function that doesn't require setShowDownload callback
export async function downloadTableAsExcel() {
    const url = getTableExcelDataUrl();
    if (!url) return;
    const text = decodeURIComponent(url.replace("data:application/vnd.ms-excel,", ""));

  
    setTimeout(() => {
      const download = true;
      try {
        const ref = window.open("about:blank", "_blank");
        if (!download) {
          ref.document.body.innerHTML = text;
        }
        if (download) {
          const downloadref = ref.document.createElement("a");
          downloadref.href = url;
          downloadref.download = `table${new Date().toISOString()}.xls`;
          ref.document.body.appendChild(downloadref);
          downloadref.click();
          ref.close();
        }
      } catch (error) {
        console.error("Error clicking download link:", error);
      }
    }, 500);
  }
  
  const computedStyleToInlineStyle = (element, options) => {
    if (!options) {
      options = {};
    }
    if (!element) {
      throw new Error("No element specified.");
    }
  
    if (options.recursive) {
      for (var z = 0; z < element.children.length; z++) {
        computedStyleToInlineStyle(element.children[z], options);
      }
    }
  
    const computedStyle = getComputedStyle(element);
    const arr = options.properties || Object.keys(computedStyle);
    for (var y = 0; y < arr.length; y++) {
      const key = arr[y];
      element.style[key] = computedStyle.getPropertyValue(key);
      if (
        key === "padding-left" &&
        computedStyle.getPropertyValue(key) === "25px"
      ) {
        element.style["mso-char-indent"] = "2";
      }
      if (
        key === "text-decoration" &&
        computedStyle.getPropertyValue(key).indexOf("underline") > -1
      ) {
        element.style["text-decoration"] = "underline";
      }
    }
  };
  