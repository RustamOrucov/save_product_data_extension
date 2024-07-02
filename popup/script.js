const addNewLinkBtn = document.querySelector("#newLinkBtn");
const exportBtn = document.querySelector("#exportBtn");
const linkContainer = document.querySelector(".links-container");


const saveNewLink = async (link, pageTitle, price, imgSrc) => {
    const data = await loadData();

    const linkExists = Object.values(data).some(item => item.link === link);

    if (linkExists) {
        alert("Link already exists");
        return;
    }

    const linkCount = Object.keys(data).length;
    const newName = String(linkCount + 1);

    const newData = {
        [newName]: {
            link: link,
            title: pageTitle,
            price: price,
            img: imgSrc
        }
    };

    chrome.storage.local.set({ ...data, ...newData }, () => {
        fetchInitialData();
    });
}


const deleteLink = async (linkData) => {
    const linkName = linkData.querySelector(".link-title").textContent;

    chrome.storage.local.remove(linkName, async () => {
        const data = await loadData();
        const reorganizedData = reorganizeKeys(data);
        chrome.storage.local.clear(() => {
            chrome.storage.local.set(reorganizedData, () => {
                fetchInitialData();
            });
        });
    });
}

const reorganizeKeys = (data) => {
    const sortedKeys = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    const reorganizedData = {};

    sortedKeys.forEach((key, index) => {
        reorganizedData[String(index + 1)] = data[key];
    });

    return reorganizedData;
}


const fetchInitialData = async () => {
    linkContainer.innerHTML = '<p>Loaded...</p>'; 

    try {
        const data = await loadData();
        const parsedData = sortLinksByKeys(data);

        console.log('Load data:', parsedData); 

        linkContainer.innerHTML = ''; 

        if (Object.keys(parsedData).length === 0 && parsedData.constructor === Object) {
            const noLinkFound = `<div class="noLinkFound">
                                    <p>Link not found,add new lind click 'Add' button</p>
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
        console.error('Data loaded error:', error);
        linkContainer.innerHTML = '<p>Data loaded error.</p>'; 
    }
}


const loadData = () => {
    return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError) {
                    resolve({});
                } else {
                    resolve(result);
                }
            });
        } else {
            resolve({});
        }
    });
}


const sortLinksByKeys = (data) => {
    const sortedData = {};
    Object.keys(data).sort().forEach(key => {
        sortedData[key] = data[key];
    });
    return sortedData;
}


addNewLinkBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];

        chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => {
                const priceElements = document.querySelectorAll('.price-text');
                let price = '';

                priceElements.forEach((elem, index) => {
                 
                    const regex = /[0-9,.]+/g;
                    const matches = elem.textContent.match(regex);
                    if (matches) {
                        price += matches.join(''); 
                        if (index < priceElements.length - 1) {
                            price += ' - '; 
                        }
                    }
                });

                const imgElement = document.querySelector('.detail-gallery-turn-wrapper img');
                const imgSrc = imgElement ? imgElement.src : null;

                return {
                    price,
                    imgSrc
                };
            }
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const { price, imgSrc } = results[0].result;
                const link = currentTab.url;
                const pageTitle = currentTab.title;

                saveNewLink(link, pageTitle, price, imgSrc);
            } else {
                console.error('Price and img not found');
            }
        });
    });
});


const exportToExcel = async (data) => {
    const parsedData = JSON.parse(JSON.stringify(data));
    const rows = [["Product name", "Link", "Price range", "Img"]];

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


    chrome.storage.local.clear(() => {
        fetchInitialData();
    });
}


exportBtn.addEventListener("click", async () => {
    const data = await loadData();
    exportToExcel(data);
});


linkContainer.addEventListener("click", (e) => {
    const getClickedLink = (e.target.tagName === "BUTTON" && e.target.className === "link-delete") ? e.target.parentElement.parentElement : (e.target.className === "fa-solid fa-trash") ? e.target.parentElement.parentElement.parentElement : null;

    if (getClickedLink)
        deleteLink(getClickedLink);
});


const deleteAllBtn = document.querySelector("#deleteAllBtn");

deleteAllBtn.addEventListener("click", () => {
    if (confirm("All link delete?")) {
        chrome.storage.local.clear(() => {
            fetchInitialData();
        });
    }
});


fetchInitialData();
