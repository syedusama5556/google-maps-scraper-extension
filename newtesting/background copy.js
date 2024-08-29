let isScrapingInProgress = false;
let scrapedCount = 0;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.action === "startScraping") {
    if (!isScrapingInProgress) {
      console.log("Starting scraping...");
      isScrapingInProgress = true;
      scrapedCount = 0;

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        console.log("Active tab found:", tabs);

        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            function: scrapeData,
          },
          () => {
            console.log("Scraping script executed.");
            isScrapingInProgress = false;
            chrome.storage.sync.get("scrapedResults", (data) => {
              console.log("Scraped results retrieved:", data);
              chrome.runtime.sendMessage({
                action: "scrapingComplete",
                results: data.scrapedResults || [],
              });
            });
          }
        );
      });
    }
    sendResponse({ status: "Scraping started" });
  } else if (message.action === "getResults") {
    console.log("Getting results...");
    chrome.storage.sync.get("scrapedResults", (data) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error retrieving data from chrome.storage.sync:",
          chrome.runtime.lastError
        );
        sendResponse({ results: [] });
      } else {
        console.log("Results retrieved:", data);
        sendResponse({ results: data.scrapedResults || [] });
      }
    });
  }
  return true; // Required to indicate async response
});

async function scrapeData() {
  console.log("Scraping data started...");
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  var links = Array.from(
    document.querySelectorAll('a[href^="https://www.google.com/maps/place"]')
  );
  console.log("Found links:", links);
  var results = [];

  for (let link of links) {
    console.log("Processing link:", link.href);
    link.click();
    await delay(5000 + Math.random() * 3000); // Increased delay between clicks to 5-8 seconds

    var container = document.querySelector(".bJzME.Hu9e2e.tTVLSc");
    if (container) {
      var titleText = "";
      var rating = "";
      var reviewCount = "";
      var phone = "";
      var industry = "";
      var address = "";
      var companyUrl = "";

      // Title
      var titleElement = container.querySelector("h1.DUwDvf.lfPIob");
      titleText = titleElement ? titleElement.textContent.trim() : "";
      console.log("Title:", titleText);

      // Rating
      var roleImgContainer = container.querySelector('[role="img"]');
      if (roleImgContainer) {
        var ariaLabel = roleImgContainer.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.includes("stars")) {
          var parts = ariaLabel.split(" ");
          rating = parts[0];
        } else {
          rating = "0";
        }
      }
      console.log("Rating:", rating);

      // Review Count
      var reviewCountElement = container.querySelector(
        '[aria-label*="reviews"]'
      );
      reviewCount = reviewCountElement
        ? reviewCountElement.textContent.trim()
        : "0";
      console.log("Review Count:", reviewCount);

      // Address
      var addressElement = container.querySelector(".rogA2c .Io6YTe");
      address = addressElement ? addressElement.textContent.trim() : "";
      if (address.startsWith("Address: ")) {
        address = address.replace("Address: ", "");
      }
      console.log("Address:", address);

      // URL
      var urlElement = container.querySelector('a[data-item-id="authority"]');
      if (urlElement) {
        var fullUrl = urlElement.getAttribute("href") || "";
        var url = new URL(fullUrl);
        companyUrl = url.origin; // This will get the base URL
      } else {
        companyUrl = "";
      }
      console.log("Company URL:", companyUrl);

      // Phone Number
      var phoneElement = container.querySelector(
        '.CsEnBe[aria-label^="Phone"]'
      );
      if (phoneElement) {
        phone = phoneElement
          .getAttribute("aria-label")
          .replace("Phone: ", "")
          .trim();
      }
      console.log("Phone:", phone);

      // Industry
      var industryElement = container.querySelector(".fontBodyMedium .DkEaL");
      industry = industryElement ? industryElement.textContent.trim() : "";
      console.log("Industry:", industry);

      results.push({
        title: titleText,
        rating: rating,
        reviewCount: reviewCount,
        phone: phone,
        industry: industry,
        address: address,
        companyUrl: companyUrl,
        href: link.href,
      });

      scrapedCount += 1;
      chrome.storage.sync.set({ scrapedCount });
      chrome.runtime.sendMessage({
        action: "updateScrapedCount",
        scrapedCount,
      });
    } else {
      console.log("Container not found for link:", link.href);
    }
  }
  chrome.storage.sync.set({ scrapedResults: results }); // Store the final results
  console.log("Scraping completed. Results:", results);

  return results;
}
