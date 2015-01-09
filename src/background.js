/*global chrome:false*/

// keyboard activation
chrome.commands.onCommand.addListener(function commands$onCommand (command) {
    console.log('got command', command);

    if (command === 'activate') {
        chrome.tabs.insertCSS({ file : 'src/content/style.css' });
        chrome.tabs.executeScript({ file : 'src/content/content.js' });
    }
});

chrome.runtime.onConnect.addListener(function runtime$onConnect (port) {
    console.log(port);

    chrome.tabs.query({}, function postTabsToPort (tabs) {
        var nonIncognitoTabs = tabs.filter(function filterIncognitoTabs (tab) {
            return !tab.incognito;
        });

        port.postMessage({
            type : 'tabs',
            tabs : nonIncognitoTabs
            // taaaaabs
        });
        // TAAAAAAAAAAAAAABS
    });

    port.onMessage.addListener(function port$onMessage (msg) {
        console.log('got message', msg);
        if (msg.type === 'select-tab') {
            chrome.tabs.update(msg.tabId, { active : true });

            chrome.tabs.get(msg.tabId, function (tab) {
                chrome.windows.update(tab.windowId, { focused : true });
            });
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
