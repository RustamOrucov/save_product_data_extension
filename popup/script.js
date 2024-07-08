const addNewLinkBtn = document.querySelector("#newLinkBtn");
const exportBtn = document.querySelector("#exportBtn");
const linkContainer = document.querySelector(".links-container");

// Verileri yerel depolamadan yükle
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

// Yeni bağlantı kaydet
const saveNewLink = async (link, pageTitle, productName, price, imgSrc, count) => {
    const data = await loadData();

    const linkExists = Object.values(data).some(item => item.link === link && item.productName === productName);

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
            productName: productName,
            price: price,
            img: imgSrc,
            count: count
        }
    };

    chrome.storage.local.set({ ...data, ...newData }, () => {
        fetchInitialData();
    });
}

// Bağlantıyı sil
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

// Anahtarları yeniden organize et
const reorganizeKeys = (data) => {
    const sortedKeys = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    const reorganizedData = {};

    sortedKeys.forEach((key, index) => {
        reorganizedData[String(index + 1)] = data[key];
    });

    return reorganizedData;
}

// Verileri yerel depolamadan yükle ve ekrana getir
const fetchInitialData = async () => {
    linkContainer.innerHTML = '<p>Loaded...</p>'; 

    try {
        const data = await loadData();
        const parsedData = sortLinksByKeys(data);

        console.log('Load data:', parsedData); 

        linkContainer.innerHTML = ''; 

        if (Object.keys(parsedData).length === 0 && parsedData.constructor === Object) {
            const noLinkFound = `<div class="noLinkFound">
                                    <p>Link not found,add new link click 'Add' button</p>
                                </div>`;
            linkContainer.insertAdjacentHTML("beforeend", noLinkFound);
        } else {
            for (const key in parsedData) {
                const linkContentBody = `<div class="link">
                                            <div class="link-context">
                                                <p class="link-title">${key}</p>
                                                <p class="link-desc">${parsedData[key].link}</p>
                                                <p class="link-desc">${parsedData[key].title}</p>
                                                <p class="link-desc">${parsedData[key].productName}</p>
                                                <p class="link-desc">${parsedData[key].price}</p>
                                                <p class="link-desc">Adet: ${parsedData[key].count}</p>
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

// Bağlantıları anahtarlara göre sırala
const sortLinksByKeys = (data) => {
    const sortedData = {};
    Object.keys(data).sort().forEach(key => {
        sortedData[key] = data[key];
    });
    return sortedData;
}

// Yeni bağlantı ekleme butonuna tıklama olayı
addNewLinkBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];

        chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => {
                const productElements = document.querySelectorAll('.sku-item-wrapper');
                const products = [];

                productElements.forEach(element => {
                    const productName = element.querySelector('.sku-item-name').textContent.trim();
                    const productPrice = element.querySelector('.discountPrice-price').textContent.trim();
                    const productCountElement = element.querySelector('.next-input-group-auto-width input');
                    const productCount = parseInt(productCountElement.value, 10);

                    // Sadece adet sayısı 0'dan büyük olan ürünleri ekle
                    if (productCount > 0) {
                        products.push({
                            name: productName,
                            price: productPrice,
                            count: productCount
                        });
                    }
                });

                const imgElement = document.querySelector('.detail-gallery-turn-wrapper img');
                const imgSrc = imgElement ? imgElement.src : null;

                return {
                    products,
                    imgSrc
                };
            }
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const { products, imgSrc } = results[0].result;
                const link = currentTab.url;
                const pageTitle = currentTab.title;

                products.forEach(product => {
                    saveNewLink(link, pageTitle, product.name, product.price, imgSrc, product.count);
                });
            } else {
                console.error('Price and img not found');
            }
        });
    });
});

// Verileri Excel'e aktar ve tüm bağlantıları temizle
const exportToExcel = async (data) => {
    const parsedData = JSON.parse(JSON.stringify(data));
    const rows = [["Product Name", "Link", "Price", "Image", "Count"]];

    for (const key in parsedData) {
        const price = parsedData[key].price;
        const imgSrc = parsedData[key].img;
        const count = parsedData[key].count;
        rows.push([parsedData[key].productName, parsedData[key].link, price, imgSrc, count]);
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

    // Tüm bağlantıları yerel depolamadan temizle
    chrome.storage.local.clear(() => {
        fetchInitialData(); // Verileri yeniden yükle
    });
}

// Excel'e aktarma butonuna tıklama olayı
exportBtn.addEventListener("click", async () => {
    const data = await loadData();
    exportToExcel(data);
});

// Bağlantı silme butonuna tıklama olayı
linkContainer.addEventListener("click", (e) => {
    const getClickedLink = (e.target.tagName === "BUTTON" && e.target.className === "link-delete") ? e.target.parentElement.parentElement : (e.target.className === "fa-solid fa-trash") ? e.target.parentElement.parentElement.parentElement : null;

    if (getClickedLink)
        deleteLink(getClickedLink);
});

// Tüm bağlantıları silme butonuna tıklama olayı
const deleteAllBtn = document.querySelector("#deleteAllBtn");

deleteAllBtn.addEventListener("click", () => {
    if (confirm("All links will be deleted. Are you sure?")) {
        chrome.storage.local.clear(() => {
            fetchInitialData();
        });
    }
});

// Başlangıçta verileri yükle
fetchInitialData();
