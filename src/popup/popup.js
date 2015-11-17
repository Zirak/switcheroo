/*global chrome:false*/

'use strict';

chrome.tabs.query({}, tabs => {
    var visibleTabs = tabs.filter(tab => tab.incognito === chrome.extension.inIncognitoContext);
    planTheSwitcheroo(visibleTabs);
});

function planTheSwitcheroo (tabs) {
    console.log('tabs', tabs);
    var container = constructContainer(),
        // the entire selected mechanism is absolute shit. but idgaf.
        selectedEl, disruptedSelection;

    container.classList.add('container');

    filterList();
    document.body.appendChild(container);

    var barKeys = {
        'Esc': function () {
            goodbye();
        },

        'Enter': function () {
            // Do the ol' switcheroo
            console.log('switching to', selectedEl);
            openSelection(selectedEl).then(goodbye);
        },

        'Up': function () {
            var prev =
                    selectedEl.previousElementSibling ||
                    container.tabList.lastElementChild;
            replaceSelected(prev);
        },

        'Down': function () {
            var next =
                    selectedEl.nextElementSibling ||
                    container.tabList.firstElementChild;
            replaceSelected(next);
        },

        'Home': function (e) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                return false;
            }
            replaceSelected(container.tabList.firstElementChild);
        },

        'End': function (e) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                return false;
            }
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

            if (barKeys[identifier](e) !== false) {
                e.preventDefault();
                disruptedSelection = true;
            }
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
        else {
            disruptedSelection = false;
        }

        if (container.tabList) {
            container.removeChild(container.tabList);
        }

        var selectedTabId = (disruptedSelection && selectedEl) && selectedEl.tabId,
            tabList = constructTabList(filtered, selectedTabId);
            container.appendChild(tabList);
            container.tabList = tabList;

        var queryAsUrl = !query ? 'chrome://newtab' :
                query[0] === '/' ?
                'file://' + query :
                    query.indexOf('://') < 0 ?
                    'http://' + query : query;

        var createTabItem = constructListItem({
            title: 'Create New Tab',
            url: queryAsUrl,
            favIconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE5LDNINUMzLjksMywzLDMuOSwzLDV2MTRjMCwxLjEsMC45LDIsMiwyaDE0YzEuMSwwLDItMC45LDItMlY1QzIxLDMuOSwyMC4xLDMsMTksM3oiIGZpbGw9IiNjY2MiLz4KPHBhdGggZD0iTTE5LDE5TDUsMTlWNWg3djRoN1YxOXoiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4='
        });
        createTabItem.url = queryAsUrl;
        tabList.appendChild(createTabItem);

        var selected = tabList.getElementsByClassName('selected')[0],
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
            firstChild.classList.add('selected');
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
            selectedEl.classList.remove('selected');
        }
        selectedEl = newSelected;
        selectedEl.classList.add('selected');

        selectedEl.scrollIntoViewIfNeeded(false);
    }
}

function constructContainer () {
    var container = document.createElement('div');
    container.classList.add('container');

    var input = document.createElement('input');
    input.autofocus = true;

    container.input = input;
    container.appendChild(input);

    return container;
}

function constructTabList (tabs, selectedTabId) {
    var list = document.createElement('ul');
    list.classList.add('list');

    tabs.map(tab => {
        // <li class="item">
        //   <img class="favicon" />
        //   <div class="title">Tab title</div>
        //   <div class="url">Loaded url</div>
        // </li>
        var item = constructListItem(tab);
        item.tabId = tab.id;

        if (tab.id === selectedTabId) {
            item.classList.add('selected');
        }

        return item;
    }).forEach(list.appendChild.bind(list));

    return list;
}
function constructListItem (tab) {
    var item = document.createElement('li');
    item.classList.add('item');

    var favicon = document.createElement('img');
    favicon.src = tab.favIconUrl;

    var titleSpan = document.createElement('div');
    titleSpan.classList.add('title');
    titleSpan.textContent = tab.title;

    var urlSpan = document.createElement('div');
    urlSpan.classList.add('url');
    urlSpan.textContent = tab.url;

    item.appendChild(favicon);
    item.appendChild(titleSpan);
    item.appendChild(urlSpan);

    return item;
}

function filterAndSort (children, query) {
    return children.map(child => {
        child.titleFuzz = fuzzyMatch(child.title, query);
        child.urlFuzz = fuzzyMatch(child.url, query);

        child.score = child.titleFuzz.score + child.urlFuzz.score;

        return child;
    })
    .filter(child => child.score > 0)
    .sort((left, right) => right.score - left.score);
}

function openSelection (selected) {
    if (selected.tabId) {
        let updateTab = stupidChromiePromisify(chrome.tabs.update),
            getTab = stupidChromiePromisify(chrome.tabs.get),
            updateWindow = stupidChromiePromisify(chrome.windows.update);

        return Promise.all([
            updateTab(selected.tabId, { active: true }),

            getTab(selected.tabId).then(tab =>
                updateWindow(tab.windowId, { focused: true })
            )
        ]);
    }
    else if (selected.url) {
        let createTab = stupidChromiePromisify(chrome.tabs.create);

        return createTab({ url: selected.url });
    }
    else {
        // meh
        console.error('I dunno wtf to do', selected);
        return Promise.reject(new TypeError('Invalid selected tab'));
    }
}

function goodbye() {
    console.log('bye bye!');
    window.close();
}

function stupidChromiePromisify(fun) {
    return function () {
        var args = Array.from(arguments);

        return new Promise(resolve => {
            args.push(resolve);
            fun.apply(this, args);
        });
    };
}

/*
   fuzzy.js v0.0.2
   (c) 2013 Ben Ripkens
   License: MIT
  */
  // slightly altered by Zirak, copyright and license honoured.
  var fuzzyMatch = (function (context) {
      'use strict';

      var fuzzy = function fuzzy(term, query) {
          var max = calcFuzzyScore(term, query);
          var termLength = term.length;

          for (var i = 1; i < termLength && i < fuzzy.analyzeSubTermDepth; i++) {
              let subTerm = term.substring(i);
              let score = calcFuzzyScore(subTerm, query);
              if (score.score > max.score) {
                  score.term = term;
                  score.matches = max.matches.concat(score.matches)
                  max = score;
              }
          }

          return max;
      };

      var calcFuzzyScore = function calcFuzzyScore(term, query) {
          var score = 0;
          var termLength = term.length;
          var queryLength = query.length;
          var ti = 0;
          var previousMatchingCharacter = -2;

          var matches = [];

          for (var qi = 0; qi < queryLength && ti < termLength; qi++) {
              let qc = query.charAt(qi);
              let lowerQc = qc.toLowerCase();

              for (; ti < termLength; ti++) {
                  let tc = term.charAt(ti);

                  if (lowerQc === tc.toLowerCase()) {
                      score++;

                      if ((previousMatchingCharacter + 1) === ti) {
                          score += 2;
                      }

                      previousMatchingCharacter = ti;
                      matches.push(ti);
                      ti++;
                      break;
                  }
              }
          }

          return { score, term, query, matches };
      };

      fuzzy.analyzeSubTermDepth = 10;

      return fuzzy;
  })(this);
