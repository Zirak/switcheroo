// keyboard activation
chrome.commands.onCommand.addListener(function (command) {
    console.log('got command', command);
    if (command === 'activate') {
        chrome.tabs.insertCSS({ file : 'content/style.css' });
        chrome.tabs.executeScript({ file : 'content/content.js' });
    }
});

chrome.runtime.onConnect.addListener(function (port) {
    console.log(port);

    chrome.tabs.query({}, function (tabs) {
        port.postMessage({
            type : 'tabs',
            tabs : tabs.filter(function (tab) { return !tab.incognito; })
            // taaaaabs
        });
        // TAAAAAAAAAAAAAABS
    });

    port.onMessage.addListener(function (msg) {
        console.log('got message', msg);
        if (msg.type === 'select-tab') {
            chrome.tabs.update(msg.tabId, { active : true });
        }
        else if (msg.type === 'create-tab') {
            chrome.tabs.create({
                url : msg.url
            });
        }
    });

    // TAAAAAAAAAAAAAAAAAAAAAAAAAABS
});

console.log('yeepee');
