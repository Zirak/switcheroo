var port = chrome.runtime.connect();
port.onMessage.addListener(function portOnMessage (msg) {
    console.log('script message', msg);

    if (msg.type === 'tabs' && msg.tabs) {
        planTheSwitcheroo(msg.tabs);
    }
});

function planTheSwitcheroo (tabs) {
    console.log('tabs', tabs);
    var container = constructContainer(),
        // the entire selected mechanism is absolute shit. but idgaf.
        selectedEl;

    filterList();
    document.body.appendChild(container);

    container.input.focus();

    var barKeys = {
        'Esc' : function () {
            container.remove();
        },

        'Enter' : function () {
            // Do the ol' switcheroo
            console.log('switchng to', selectedEl.url);

            if (selectedEl.tabId) {
                port.postMessage({
                    type  : 'select-tab',
                    tabId : selectedEl.tabId
                });
            }
            else if (selectedEl.url) {
                port.postMessage({
                    type : 'create-tab',
                    url  : selectedEl.url
                });
            }
            else {
                console.warn('I dunno wtf to do %o', selectedEl);
            }
            container.remove();
        },

        'Up' : function () {
            var prev =
                    selectedEl.previousElementSibling ||
                    container.tabList.lastElementChild;
            replaceSelected(prev);
        },

        'Down' : function () {
            var next =
                    selectedEl.nextElementSibling ||
                    container.tabList.firstElementChild;
            replaceSelected(next);
        },

        'Home' : function () {
            replaceSelected(container.tabList.firstElementChild);
        },

        'End' : function () {
            replaceSelected(container.tabList.lastElementChild);
        }
    };

    container.input.onkeydown = function input$onkeydown (e) {
        var identifier = e.keyIdentifier;
        if (e.which === 27) {
            identifier = 'Esc';
        }

        if (barKeys.hasOwnProperty(identifier)) {
            console.log(e, identifier);
            e.preventDefault();
            barKeys[identifier]();
        }
    };

    container.input.oninput = function input$oninput () {
        filterList(this.value);
    };

    function filterList (query) {
        var filtered = tabs;

        if (query) {
            filtered = filterAndSort(tabs, query);
        }

        if (container.tabList) {
            container.removeChild(container.tabList);
        }
		
		var tabList = constructTabList(filtered, selectedEl && selectedEl.tabId, query);
        container.appendChild(tabList);
        container.tabList = tabList;

        var queryAsUrl = !query ? '' :
                query[0] === '/' ?
                'file://' + query :
                    query.indexOf('://') < 0 ?
                    'http://' + query : query;

        var createTabItem = constructListItem({
            title : 'Create New Tab',
            url : queryAsUrl,
            favIconUrl : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGcgaWQ9InRhYiI+PHBhdGggZD0iTTE5LDNINUMzLjksMywzLDMuOSwzLDV2MTRjMCwxLjEsMC45LDIsMiwyaDE0YzEuMSwwLDItMC45LDItMlY1QzIxLDMuOSwyMC4xLDMsMTksM3ogTTE5LDE5TDUsMTlWNWg3djRoN1YxOXoiPjwvcGF0aD48L2c+PC9zdmc+'
        });
        createTabItem.url = queryAsUrl;
        tabList.appendChild(createTabItem);

        var selected = tabList.getElementsByClassName('switcheroo-selected')[0],
            firstChild = tabList.children[0];

        // selectedEl is the element in the old tree. we need to replace it with
        //the one in the new tree we just made.
        if (selected) {
            // TODO if the selected element is far down the list, we still keep
            //it selected and jump to it. maybe if it's not visible in the first
            //page, select the first? what'll be better UX?
            replaceSelected(selected);
        }
        // the selection didn't hold?
        else if (!selected && firstChild) {
            firstChild.classList.add('switcheroo-selected');
            replaceSelected(firstChild);
        }
        else if (!firstChild) {
            selectedEl = null;
            console.log('filterList no elements');
        }
        console.log('filterList selected', selectedEl);
    }

    function replaceSelected (newSelected) {
        console.log('replaceSelected', selectedEl, newSelected);
        if (selectedEl) {
            selectedEl.classList.remove('switcheroo-selected');
        }
        selectedEl = newSelected;
        selectedEl.classList.add('switcheroo-selected');

        selectedEl.scrollIntoViewIfNeeded(false);
    }
}

function constructContainer (tabs) {
    var container = document.createElement('div');
    container.classList.add('switcheroo-container');

    var input = document.createElement('input');

    container.input = input;
    container.appendChild(input);

    return container;
}

function constructTabList (tabs, selectedTabId, query) {
    var list = document.createElement('ul');
    list.classList.add('switcheroo-list');

    tabs.map(function (tab) {
        // <li class="switcheroo-item">
        //   <img class="switcheroo-favicon" />
        //   <div class="switcheroo-title">Tab title</div>
        //   <div class="switcheroo-url">Loaded url</div>
        // </li>
        var item = constructListItem(tab, query);
        item.tabId = tab.id;

        if (tab.id === selectedTabId) {
            item.classList.add('switcheroo-selected');
        }

        return item;
    }).forEach(list.appendChild.bind(list));

    return list;
}
function constructListItem (tab, query) {
    var item = document.createElement('li');
    item.classList.add('switcheroo-item');

    var favicon = document.createElement('img');
    favicon.src = tab.favIconUrl;
			
	
    var titleSpan = document.createElement('div');
    titleSpan.classList.add('switcheroo-title');
	titleSpan.innerHTML = !query ? tab.title : highlightText(tab.title, query);
	
	
    var urlSpan = document.createElement('div');
    urlSpan.classList.add('switcheroo-url');
	urlSpan.innerHTML = !query ? tab.url : highlightText(tab.url, query);

    item.appendChild(favicon);
    item.appendChild(titleSpan);
    item.appendChild(urlSpan);

    return item;
}

function filterAndSort (children, query) {
    return children.map(function (child) {
        child.score =
            scoreString(child.title, query) +
            scoreString(child.url, query);

        return child;
    }).filter(function (child) {
        return child.score > 0;
    }).sort(function (left, right) {
        return right.score - left.score;
    });
}

// Highlight parts of the string which match the query
function highlightText (string, query) {
	var escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
	var regEx = new RegExp( '(' + escapedQuery + ')', 'gi' );
	return string.replace( regEx, '<span class="switcheroo-highlight">$1</span>');
}

/*!
 * string_score.js: String Scoring Algorithm 0.1.21
 *
 * http://joshaven.com/string_score
 * https://github.com/joshaven/string_score
 *
 * Copyright (C) 2009-2014 Joshaven Potter <yourtech@gmail.com>
 * Special thanks to all of the contributors listed here https://github.com/joshaven/string_score
 * MIT License: http://opensource.org/licenses/MIT
 */
// slightly altered by Zirak, copyright and license honoured.
function scoreString (string, word) {
    'use strict';

    // If the string is equal to the word, perfect match.
    if (string === word) { return 1; }

    //if it's not a perfect match and is empty return 0
    if (word === '') { return 0; }

    var runningScore = 0,
        charScore,
        finalScore,
        lString = string.toLowerCase(),
        strLength = string.length,
        lWord = word.toLowerCase(),
        wordLength = word.length,
        idxOf,
        startAt = 0,
        fuzzies = 1;

    for (var i = 0; i < wordLength; ++i) {
        idxOf = lString.indexOf(lWord[i], startAt);
        if (-1 === idxOf) {
            return 0;
        }
        else if (startAt === idxOf) {
            charScore = 0.7;
        }
        else {
            charScore = 0.1;
            if (string[idxOf - 1] === ' ') {
                charScore += 0.8;
            }
        }

        if (string[idxOf] === word[i]) {
            charScore += 0.1;
        }
        runningScore += charScore;
        startAt = idxOf + 1;
    }

    // Reduce penalty for longer strings.
    finalScore = 0.5 *
        (runningScore / strLength + runningScore / wordLength) /
        fuzzies;

    if ((lWord[0] === lString[0]) && (finalScore < 0.85)) {
        finalScore += 0.15;
    }

    return finalScore;
}
