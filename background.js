let isScrapingInProgress = false;
let scrapedResults = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script:", message);

  if (message.action === "startScraping") {
    if (!isScrapingInProgress) {
      isScrapingInProgress = true;
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            function: initiateScraping,
          },
          (injectionResults) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              isScrapingInProgress = false;
            }
            sendResponse({ status: "Scraping initiated" });
          }
        );
      });
    } else {
      sendResponse({ status: "Scraping already in progress" });
    }
  } else if (message.action === "stopScraping") {
    isScrapingInProgress = false;
    sendResponse({ status: "Scraping stopped" });
  } else {
    sendResponse({ status: "Unknown action" });
  }
  return true;
});

function initiateScraping() {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  let processedLinks = new Set();
  let results = [];

  async function scrollToNextElementTillEndReached(scrollableElement) {
    console.log("Scrolling to next element ");
    const endOfListIndicator = document.querySelector(
      "div.m6QErb.XiKgde.tLjsW.eKbjU"
    );

    const isEndOfListReached = () => {
      if (endOfListIndicator && endOfListIndicator.offsetParent !== null) {
        const endText = endOfListIndicator.textContent.trim();
        return endText.includes("You've reached the end of the list.");
      }
      return false;
    };
    if (!scrollableElement) {
      console.log("Scrollable element not found.");
      return;
    }

    if (!isEndOfListReached()) {
      console.log("Scrolling done.");
      scrollableElement.scrollIntoView();
      await delay(1000);

      const newLinks = Array.from(
        document.querySelectorAll(
          'a[href^="https://www.google.com/maps/place"]'
        )
      ).filter((li) => !processedLinks.has(li.href));

      return newLinks;
    } else {
      console.log("End of list reached.");
    }

    return [];
  }

  async function processLink(link) {
    if (processedLinks.has(link.href)) {
      return;
    }

    link.click();
    await delay(5000 + Math.random() * 2500);

    const container = document.querySelector(".bJzME.Hu9e2e.tTVLSc");
    if (container) {
      const titleElement = container.querySelector("h1.DUwDvf.lfPIob");
      const titleText = titleElement ? titleElement.textContent.trim() : "";

      const roleImgContainer = container.querySelector('[role="img"]');
      let rating = "0";
      if (roleImgContainer) {
        const ariaLabel = roleImgContainer.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.includes("stars")) {
          rating = ariaLabel.split(" ")[0];
        }
      }

      const reviewCountElement = container.querySelector(
        '[aria-label*="reviews"]'
      );
      const reviewCount = reviewCountElement
        ? reviewCountElement.textContent.trim()
        : "0";

      const addressElement = container.querySelector(".rogA2c .Io6YTe");
      let address = addressElement ? addressElement.textContent.trim() : "";
      address = address.replace("Address: ", "");

      const urlElement = container.querySelector('a[data-item-id="authority"]');
      let companyUrl = "";
      if (urlElement) {
        const fullUrl = urlElement.getAttribute("href") || "";
        const url = new URL(fullUrl);
        companyUrl = url.origin;
      }

      const phoneElement = container.querySelector(
        '.CsEnBe[aria-label^="Phone"]'
      );
      const phone = phoneElement
        ? phoneElement.getAttribute("aria-label").replace("Phone: ", "").trim()
        : "";

      const industryElement = container.querySelector(".fontBodyMedium .DkEaL");
      const industry = industryElement
        ? industryElement.textContent.trim()
        : "";

      console.log(
        `Title: ${titleText}, Rating: ${rating}, Review Count: ${reviewCount}, Phone: ${phone}, Industry: ${industry}, Address: ${address}, Company URL: ${companyUrl}, Google Maps Link: ${link.href}`
      );

   

      const result = {
        title: titleText,
        rating,
        reviewCount,
        phone,
        industry,
        address,
        companyUrl,
        href: link.href,
      };

      if (!results.find(item => item.href === result.href)) {
        results.push(result);
        processedLinks.add(link.href);
  
        
        // Send progress update
        chrome.runtime.sendMessage({
          action: "scrapingProgress",
          scrapedCount: results.length,
          latestResult: result,
        });
        console.log(`Processed: ${titleText}`);
      }
    }
  }

  async function main() {
    let links = Array.from(
      document.querySelectorAll('a[href^="https://www.google.com/maps/place"]')
    );
  
    while (links.length > 0) {
      const link = links.shift(); // Take the first link
  
      await processLink(link); // Process the link
  
      const newLinks = await scrollToNextElementTillEndReached(link); // Get new links
  
      // Add only new, unique links to the array
      for (const newLink of newLinks) {
        if (!links.some(existingLink => existingLink.href === newLink.href)) {
          links.push(newLink);
        }
      }
    }
  
    return results;
  }

  main().then((finalResults) => {
    chrome.runtime.sendMessage({
      action: "scrapingComplete",
      results: finalResults,
      scrapedCount: finalResults.length,
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message.action === "scrapingProgress" ||
    message.action === "scrapingComplete"
  ) {
    chrome.runtime.sendMessage(message);
  }
});
