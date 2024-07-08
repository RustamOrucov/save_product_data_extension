let intervalTimer;

// Load key-value pairs data from browser local storage 
const loadData = () => {
    return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError)
                    resolve([]);
                else
                    resolve(result);
            });
        } else {
            resolve([]);
        }
    });
}

// Check if the input element is a text box 
const checkInputElement = async (e) => {
    const isInputBox = e.target.tagName === "INPUT";
    const isTextBox = e.target.tagName === "TEXTAREA";

    if (isInputBox || isTextBox) {
        const inputElement = e.target;
        const value = inputElement.value;

        const getIndexOfSign = value.lastIndexOf("$");

        if (getIndexOfSign !== -1) {
            const jsonData = await loadData();
            const parsedData = JSON.parse(JSON.stringify(jsonData));

            // check keys using regex 
            const regex = /\$([a-zA-Z0-9]+)/g;
            e.target.value = value.replaceAll(regex, (match, getKey) => {
                if (parsedData.hasOwnProperty(getKey))
                    return parsedData[getKey];
                else
                    return match;
            });
        }
    }
};

// Parse price from the page
const parsePrice = () => {
    const priceElement = document.querySelector('.price-text');
    if (priceElement) {
        return priceElement.textContent.trim();
    } else {
        return "Fiyat bulunamadı";
    }
}

// Parse image from the page
const parseImage = () => {
    const galleryWrapper = document.querySelector('.detail-gallery-turn-wrapper');
    if (galleryWrapper) {
        const imgElement = galleryWrapper.querySelector('img');
        if (imgElement) {
            return imgElement.src;
        }
    }
    return null;
}

// Capture form text input events
document.addEventListener("input", (e) => {
    clearInterval(intervalTimer);
    intervalTimer = setTimeout(() => checkInputElement(e), 100);
});

// Add button click event
document.addEventListener("DOMContentLoaded", () => {
    const addNewLinkBtn = document.querySelector("#newLinkBtn");

    addNewLinkBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const currentTab = tabs[0];
            const link = currentTab.url;
            const pageTitle = currentTab.title;
            const price = parsePrice();
            const imgSrc = parseImage();

            saveNewLink(link, pageTitle, price, imgSrc);
        });
    });
});


// Save new link to local storage
const saveNewLink = async (link, pageTitle, price, imgSrc) => {
    const data = await loadData();

    // Check if link already exists
    const linkExists = Object.values(data).some(item => item.link === link);

    if (linkExists) {
        alert("Bu link zaten kaydedilmiş.");
        return;
    }

    // Find the next available name for the link
    let newName = 1;
    while (data[newName]) {
        newName++;
    }

    // Update existing keys to shift them up
    const newData = {};
    for (const key in data) {
        newData[String(parseInt(key) + 1)] = data[key];
    }

    // Add the new link data
    newData[String(newName)] = {
        link: link,
        title: pageTitle,
        price: price,
        img: imgSrc
    };

    chrome.storage.local.set(newData, () => {
        fetchInitialData();
    });
}


// Load initial data
const fetchInitialData = async () => {
    const linkContainer = document.querySelector(".links-container");
    linkContainer.innerHTML = '<p>Veriler yükleniyor...</p>'; // Show loading message

    try {
        const data = await loadData();
        const parsedData = JSON.parse(JSON.stringify(data));

        console.log('Loaded data:', parsedData); // Debug output

        linkContainer.innerHTML = ''; // Clear content

        if (Object.keys(parsedData).length === 0 && parsedData.constructor === Object) {
            const noLinkFound = `<div class="noLinkFound">
                                    <p>Link bulunamadı, lütfen "Ekle" butonuna tıklayarak bir link eklemeyi deneyin.</p>
                                </div>`;
            linkContainer.insertAdjacentHTML("beforeend", noLinkFound);
        } else {
            for (const key in parsedData) {
                const linkContentBody = `<div class="link">
                                            <div class="link-context">
                                                <p class="link-title">${key}</p>
                                                <p class="link-desc">${parsedData[key].link}</p>
                                                <p class="link-desc">${parsedData[key].title}</p>
                                                <p class="link-desc">${parsedData[key].price}</p>
                                                <p class="link-desc">${parsedData[key].img ? `<img src="${parsedData[key].img}" width="30" height="30" />` : 'Resim bulunamadı'}</p>
                                            </div>
                                            <div class="link-button">
                                                <button class="link-delete" title="Sil" type="button"><i class="fa-solid fa-trash"></i></button>
                                            </div>
                                        </div>`;
                linkContainer.insertAdjacentHTML("beforeend", linkContentBody);
            }
        }
    } catch (error) {
        console.error('Veri yüklenirken bir hata oluştu:', error);
        linkContainer.innerHTML = '<p>Veriler yüklenirken bir hata oluştu.</p>'; 
    }
}

// Delete link from local storage
const deleteLink = (linkData) => {
    const linkName = linkData.querySelector(".link-title").textContent;

    chrome.storage.local.remove(linkName, () => {
        fetchInitialData();
    });
}


// Export data to Excel and clear all links
const exportToExcel = async (data) => {
    const parsedData = JSON.parse(JSON.stringify(data));
    const rows = [["Product Name", "Link", "Price Range", "Image"]];

    for (const key in parsedData) {
        const price = parsedData[key].price;
        const imgSrc = parsedData[key].img;
        rows.push([parsedData[key].title, parsedData[key].link, price, imgSrc]);
    }

    let csvContent = "data:text/csv;charset=utf-8," 
        + rows.map(e => e.join(",")).join("\n");

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "links.csv");
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);

    // Clear all links from local storage
    chrome.storage.local.clear(() => {
        fetchInitialData(); // Verileri yeniden yükle
    });
}

// Excel export button event listener
document.querySelector("#exportBtn").addEventListener("click", async () => {
    const data = await loadData();
    exportToExcel(data);
});


// Excel export button event listener
document.querySelector("#exportBtn").addEventListener("click", async () => {
    const data = await loadData();
    exportToExcel(data);
});

// Delete button event listener
document.querySelector(".links-container").addEventListener("click", (e) => {
    const getClickedLink = (e.target.tagName === "BUTTON" && e.target.className === "link-delete") ? e.target.parentElement.parentElement : (e.target.className === "fa-solid fa-trash") ? e.target.parentElement.parentElement.parentElement : null;

    if (getClickedLink)
        deleteLink(getClickedLink);
});

fetchInitialData();
