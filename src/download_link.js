// Alternative function that doesn't require setShowDownload callback
export async function downloadTableAsExcel() {
    const props = [
      "font-size",
      "color",
      "height",
      "width",
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
      "background-color",
    ];
  
    var tbl = document.getElementById("reportTable");
  
    if (!tbl) {
      console.error("Table element with id 'reportTable' not found");
      return;
    }
  
    var copy_tbl = tbl.cloneNode(true);
    computedStyleToInlineStyle(tbl, { recursive: true, properties: props });
  
    var text =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    text +=
      '<meta http-equiv=Content-Type content="text/html; charset=utf-8"><body>';
    text += '<meta name=Generator content="Microsoft Excel 15">';
    text += tbl.outerHTML;
    text += "</body></html>";
  
    const url = "data:application/vnd.ms-excel," + encodeURIComponent(text);
  
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
        // Clean up on error too
        URL.revokeObjectURL(url);
        document.body.removeChild(downloadLink);
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
  