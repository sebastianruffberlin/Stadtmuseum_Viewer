// christopher pietsch
// cpietsch@gmail.com
// 2015-2018

function Tags() {
  var margin = {top: 10, right: 20, bottom: 20, left: 10},
      width = window.innerWidth - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  var container;
  var keywordsScale = d3.scale.linear();
  var keywordsOpacityScale = d3.scale.linear();
  var keywords = [];
  var wordBackground;
  var keywordsNestGlobal;
  var sortKeywords = "alphabetical";

  var filterWords = []; // This array stores active words from the tagcloud

  var data, filteredData;
  var activeWord;

  // NEW: Filter object to manage only your specific category filters
  var filter = {
    geschlecht: [] // Only 'geschlecht' filter category
  };

  // NEW: sortArrays for specific ordering of your new filter
  var sortArrays = {
    geschlecht: ["Mann", "Frau"]
  };

  // NEW: addOrRemove function for filter array manipulation
  function addOrRemove(array, value) {
    array = array.slice();
    var index = array.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
    } else {
      array.push(value);
    }
    return array;
  }

  var x = d3.scale.ordinal()
    .rangeBands([0, width]);

  var sliceScale = d3.scale.linear().domain([1200,5000]).range([50, 200])

  var lock = false;
  var state = { init: false, search: '' };

  function tags(){ }

  tags.state = state

  tags.init = function(_data, config) {
    data = _data;

    // The tagcloud container itself
    container = d3.select(".page").append("div")
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom)
      .classed("tagcloud", true)
      .style("color", config.style.fontColor)
      .append("div")

    if (config.sortKeywords != undefined) {
      sortKeywords = config.sortKeywords;
    }

    // Call updateFilters to initialize and display category filter buttons (like Geschlecht)
    tags.updateFilters();

    tags.update(); // Update the tagcloud itself based on initial data
  }

  tags.resize = function(){
    if(!state.init) return;

    width = window.innerWidth - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

    container
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom)

    x.rangeBands([0, width]);

    tags.update(); // Update the tagcloud layout
    tags.updateFilters(); // Also update category filters on resize
  }

  // This `tags.filter` function is now responsible for applying ALL filters (tagcloud, category, search)
  // to determine which data items are `active` and `highlight`.
  tags.filter = function(tagcloudFilterWords, highlightMode){ // Renamed parameter for clarity
    var currentCategoryFilters = Object.entries(filter).filter(function (d) { return d[1].length; }); // Get active category filters

    data.forEach(function(d) {
      var searchMatch = state.search !== "" ? d.search.indexOf(state.search) > -1 : true;

      // Check if item matches all active category filters
      var categoryFilterMatch = currentCategoryFilters.every(function (f) {
        return f[1].indexOf(d[f[0]]) > -1; // Checks if d[column_name] is in the active filter values
      });

      // Check if item matches active tagcloud filter words
      var tagcloudMatch = tagcloudFilterWords.every(function(word){
        // Ensure d.keywords is an array. If it's a comma-separated string, split it.
        var itemKeywords = typeof d.keywords === 'string' ? d.keywords.split(',').map(s => s.trim()) : d.keywords;
        return Array.isArray(itemKeywords) && itemKeywords.indexOf(word) > -1;
      });

      var overallActive = searchMatch && categoryFilterMatch && tagcloudMatch;

      if(highlightMode) d.highlight = overallActive;
      else d.active = overallActive;
    });

  }

  tags.update = function() {
    // This 'update' function is mainly for re-rendering the Tagcloud itself.
    // It calls `tags.filter` to get the currently active items and then processes their keywords.

    tags.filter(filterWords); // Apply current tagcloud filters to determine active items for the tagcloud

    var keywords = [];
    data.forEach(function(d) {
      if(d.active){ // Only include keywords from currently active items
        var itemKeywords = typeof d.keywords === 'string' ? d.keywords.split(',').map(s => s.trim()) : d.keywords;
        if (Array.isArray(itemKeywords)) {
          itemKeywords.forEach(function(keyword) {
            if (keyword) keywords.push({ keyword: keyword, data: d }); // Ensure keyword is not empty
          })
        }
      }
    });

    keywordsNestGlobal =  d3.nest()
      .key(function(d) { return d.keyword; })
      .rollup(function(d){
        return d.map(function(d){ return d.data; });
      })
      .entries(keywords)
      .sort(function(a,b){
        return b.values.length - a.values.length;
      })

    var sliceNum = parseInt(sliceScale(width));
    var keywordsNest = keywordsNestGlobal.slice(0,sliceNum);

    if (sortKeywords == "alphabetical") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.ascending(a.key, b.key); // Sort by key (string) directly
      });
    } else if (sortKeywords == "alfabetical-reverse") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.descending(a.key, b.key);
      });
    } else if (sortKeywords == "count") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.descending(a.values.length, b.values.length);
      });
    } else if (sortKeywords == "count-reverse") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.ascending(a.values.length, b.values.length);
      });
    } else if (Array.isArray(sortKeywords)) {
      var lowerCaseSortKeywords = sortKeywords.map(function (d) { return d.toLowerCase(); });
      keywordsNest = keywordsNest.sort(function(a,b){
        var indexA = lowerCaseSortKeywords.indexOf(a.key.toLowerCase());
        var indexB = lowerCaseSortKeywords.indexOf(b.key.toLowerCase());
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    var keywordsExtent = d3.extent(keywordsNest, function (d) {
      return d.values.length;
    });

    keywordsScale
      .domain(keywordsExtent)
      .range([10,20]);

    if(keywordsExtent[0]==keywordsExtent[1]) keywordsScale.range([15,15])

    keywordsOpacityScale
      .domain(keywordsExtent)
      .range([0.2,1]);

    layout(keywordsNest);
    tags.draw(keywordsNest);

    // After updating the tagcloud, also re-project canvas.
    canvas.highlight();
    canvas.project();
  }

  function layout(data){
    var p = 1.8;
    var p2 = 1;
    var x0 = 0;

    data.forEach(function(d){
      d.x = x0 + keywordsScale(d.values.length)*p +p2;
      x0 += keywordsScale(d.values.length)*p;
    })
  };

  function getTranslateForList(data){
    var w = _.last(data).x + 100;
    return width/2 - w/2;
  }

  tags.draw = function(words) {

    var select = container
      .selectAll(".tag")
        .data(words, function(d){ return d.key; })

    select
      .classed("active", function(d){ return filterWords.indexOf(d.key) > -1; })
      .style("transform", function(d,i){ return "translate(" + d.x + "px,0px) rotate(45deg)"; })
      .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
      .style("opacity", 1)

    var e = select.enter().append("div")
        .classed("tag", true)
        .on("mouseenter", tags.mouseenter)
        .on("mouseleave", tags.mouseleave)
        .on("click", tags.mouseclick)
        .style("transform", function(d,i){ return "translate(" + d.x + "px,0px) rotate(45deg)"; })
        .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
        .style("opacity", 0)

    e.append("span")
        .text(function(d) { return d.key; })

    e.append("div")
      .classed("close", true)

    e.transition()
      .delay(400)
      .duration(0)
      .style("transform", function(d,i){ return "translate(" + d.x + "px,0px) rotate(45deg)"; })
      .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
      .style("opacity", 1)

    select.exit()
      .style("opacity", 0)
      .remove();

    if(words.length === 0) return

    var w = getTranslateForList(words);

    container
      .style("transform", function(d,i){ return "translate(" + w + "px,0px)"; })

  }

  // NEW: This is the logic to render and update the category filter buttons (like "Geschlecht")
  tags.updateDom = function updateDom(key, filteredData) {

    // Use sortArrays for ordering the filter buttons
    if (sortArrays[key]) {
      var sorted = sortArrays[key];
      filteredData.sort(function (a, b) {
        return sorted.indexOf(a.key) - sorted.indexOf(b.key);
      });
    }

    // Replace special characters for CSS class name to match HTML
    var classLabel = key.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Select the filter container by its class name (e.g., '.geschlecht')
    // This assumes the HTML structure <div class="topfilter geschlechtOuter"><div class="items geschlecht"></div></div>
    // and targets the inner 'items' div to append buttons.
    var container = d3.select(".items." + classLabel);

    if (container.empty()) {
        console.warn("Filter container not found for key:", key, ". Expected class: .items." + classLabel);
        return; // Exit if container doesn't exist in HTML
    }

    var selection = container
      .selectAll(".item")
      .data(filteredData, function (d) { return d.key; });

    selection
      .enter()
      .append("div")
      .classed("item", true)
      .text(function (d) {
        return d.key;
      })
      .on("click", function (d) {
        lock = true;
        filter[key] = addOrRemove(filter[key], d.key); // Update the category filter state
        tags.filter(filterWords); // Re-apply all filters including tagcloud and category filters
        tags.updateFilters(); // Re-evaluate and update all category filters' button counts/states
        lock = false;
      })
      // Conditional font sizing for 'vorbesitzerin' or 'geschlecht' (if you enable it later)
      // Keeping it simple here as it's not explicitly requested for "Geschlecht" by default
      // .filter(function (d) {
      //   return key === "vorbesitzerin" || key === "geschlecht";
      // })
      // .style("font-size", function (d) {
      //   return fontsize(d.size) + "px";
      // });

    selection.exit()
      .classed("active", false)
      .classed("hide", true)
      // .filter(function (d) { // If you enable font sizing on exit, enable this filter as well
      //   return key === "vorbesitzerin" || key === "geschlecht";
      // })
      .remove(); // Removed fixed font-size reset from exit, let CSS handle it

    selection
      .classed("active", function (d) {
        return filter[key].indexOf(d.key) > -1;
      })
      .classed("hide", false);
      // .filter(function (d) { // If you enable font sizing, enable this filter as well
      //   return key === "vorbesitzerin" || key === "geschlecht";
      // })
      // .style("font-size", function (d) { // Removed fixed font-size, let CSS handle it unless dynamic size needed
      //   return fontsize(d.size) + "px";
      // })
      // .sort(function (a, b) { // Sorting already happens at the top of updateDom if sortArrays[key] exists
      //   return b.size - a.size;
      // });
  };


  // NEW: This is the core logic to calculate counts for category filters
  tags.updateFilters = function updateFilters() {
    var allFilterKeys = Object.keys(filter); // Get all defined category filter keys (e.g., 'geschlecht')

    for (var a = 0; a < allFilterKeys.length; a++) {
      var currentFilterKey = allFilterKeys[a];
      var index = {};

      // Create a temporary filter list that EXCLUDES the currentFilterKey,
      // and only includes other active filters.
      var otherActiveCategoryFilters = Object.entries(filter).filter(function (d) {
        return d[0] !== currentFilterKey && d[1].length > 0;
      });

      // Also consider the active tagcloud filters and search query for counting
      var currentTagcloudFilterWords = filterWords;
      var currentSearchQuery = state.search;

      // Iterate through the entire dataset to count items for the `currentFilterKey`
      data.forEach(function (d) {
        // Check if the item matches the search query
        var searchMatch = currentSearchQuery !== "" ? d.search.indexOf(currentSearchQuery) > -1 : true;

        // Check if the item matches all OTHER active category filters
        var matchesOtherCategoryFilters = otherActiveCategoryFilters.every(function (otherFilterEntry) {
          var filterColumn = otherFilterEntry[0];
          var filterValues = otherFilterEntry[1];
          // Ensure the item's value for the filter column is in the active filter values
          return filterValues.indexOf(d[filterColumn]) > -1;
        });

        // Check if the item matches all active tagcloud filter words
        var matchesTagcloudFilterWords = currentTagcloudFilterWords.every(function(word){
          var itemKeywords = typeof d.keywords === 'string' ? d.keywords.split(',').map(s => s.trim()) : d.keywords;
          return Array.isArray(itemKeywords) && itemKeywords.indexOf(word) > -1;
        });


        // If the item matches all *other* active filters (search, tagcloud, and other categories)
        if (searchMatch && matchesOtherCategoryFilters && matchesTagcloudFilterWords) {
          // Increment count for the current item's value in `currentFilterKey`'s column
          var itemValue = d[currentFilterKey];
          if (itemValue !== undefined && itemValue !== null && itemValue !== "") { // Ensure value is valid
            index[itemValue] = (index[itemValue] || 0) + 1;
          }
        }
      });

      // Format the counts into an array of {key: value, size: count} objects
      var filteredDataForDom = Object.keys(index)
        .map(function (dKey) { return { key: dKey, size: index[dKey] }; })
        .sort(function (a, b) { return b.size - a.size; }) // Sort by count descending
        .filter(function (dItem) { return dItem.key !== "" && dItem.key !== "undefined"; }); // Filter out empty/undefined keys

      tags.updateDom(currentFilterKey, filteredDataForDom); // Update the DOM for this specific filter category
    }
  };


  tags.reset = function(){
    // Reset Tagcloud filterWords
    filterWords = [];
    // Reset all category filters (only 'geschlecht' in this version)
    Object.keys(filter).forEach(function (key) {
      filter[key] = [];
    });

    tags.filter(filterWords); // Apply reset (empty array for tagcloud, will cause category filters to be empty too)
    tags.updateFilters(); // Update category filter UI
    tags.update(); // Update tagcloud counts and re-project (calls canvas.highlight/project)
  }

  // tags.mouseclick for Tagcloud words
  tags.mouseclick = function (d) {
    lock = true;

    if(filterWords.indexOf(d.key)>-1){
      _.remove(filterWords,function(d2){ return d2 == d.key; });
    } else {
      filterWords.push(d.key);
    }

    tags.updateFilters(); // Update category filters as tagcloud filter has changed
    tags.update(); // Update the tagcloud and trigger canvas.project()

    lock = false
  }

  // tags.mouseleave for Tagcloud words
  tags.mouseleave = function (d) {
    if(lock) return;

    container
      .selectAll(".tag")
      .style("opacity", 1)

    // Re-evaluate highlight state based on active filters (not hover)
    tags.filter(filterWords); // Use current tagcloud filter (not hover)
    canvas.highlight();
  }

  // tags.mouseenter for Tagcloud words
  tags.mouseenter = function (d1) {
    if(lock) return;

    var tempFilterWords = _.clone(filterWords);
    if (tempFilterWords.indexOf(d1.key) === -1) { // Only add if not already selected
      tempFilterWords.push(d1.key);
    }

    tags.highlightWords(tempFilterWords);
  }

  // tags.highlightWords for Tagcloud words (visual highlight on hover/selection)
  tags.highlightWords = function(words){

    // Re-evaluate 'highlight' based on the given 'words' (tagcloud hover/selection)
    // and current category filters and search.
    var currentCategoryFilters = Object.entries(filter).filter(function (d) { return d[1].length; });
    var currentSearchQuery = state.search;

    data.forEach(function(d) {
      var searchMatch = currentSearchQuery !== "" ? d.search.indexOf(currentSearchQuery) > -1 : true;
      var categoryFilterMatch = currentCategoryFilters.every(function (f) {
        return f[1].indexOf(d[f[0]]) > -1;
      });
      var tagcloudMatch = words.every(function(word){
        var itemKeywords = typeof d.keywords === 'string' ? d.keywords.split(',').map(s => s.trim()) : d.keywords;
        return Array.isArray(itemKeywords) && itemKeywords.indexOf(word) > -1;
      });

      d.highlight = searchMatch && categoryFilterMatch && tagcloudMatch;
    });

    container
      .selectAll(".tag")
      .style("opacity", function(d){
        // A tag is visible if any item associated with it is highlighted
        return d.values.some(function(d_item){ return d_item.highlight; }) ? 1 : 0.2;
      });

    canvas.highlight();
  }

  // tags.search for search bar interaction
  tags.search = function(query){

    state.search = query

    tags.filter(filterWords); // Re-apply all filters including search
    tags.updateFilters(); // Update category filter counts
    tags.update(); // Update tagcloud counts and re-project (calls canvas.highlight/project)
  }

  return tags;
}
