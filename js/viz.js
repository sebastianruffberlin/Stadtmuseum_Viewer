// christopher pietsch
// @chrispiecom
// 2015-2018

utils.welcome();

var data;
var tags;
var canvas;
var search;
var ping;
var timeline; // Declared globally

if (Modernizr.webgl && !utils.isMobile()) {
  init();
}

function init() {
  // Instantiate the individual modules first
  canvas = Canvas();
  search = Search();
  timeline = Timeline(); // Instantiated here
  ping = utils.ping();

  var baseUrl = utils.getDataBaseUrl();
  var makeUrl = utils.makeUrl;

  console.log(baseUrl);

  d3.json(baseUrl.config || "data/config.json", function (config) {
    config.baseUrl = baseUrl;
    utils.initConfig(config);

    // Determine the timeline data URL. If config.loader.timeline is undefined, it defaults to null.
    var timelineDataUrl = config.loader.timeline ? makeUrl(baseUrl.path, config.loader.timeline) : null;

    // Load timeline data first (if URL exists), then items data
    Loader(timelineDataUrl).finished(function (_timelineData) { // _timelineData will be the loaded CSV data or an empty array
      Loader(makeUrl(baseUrl.path, config.loader.items)).finished(function (_data) {
        data = _data; // Assign to the global 'data' variable
        console.log(data);

        utils.clean(data, config.delimiter);

        // Initialize timeline module with the loaded data (or empty array if not loaded)
        timeline.init(_timelineData || [], config); // Pass loaded data (or empty array) to timeline.init

        if(config.filter && config.filter.type === "crossfilter") {
          tags = Crossfilter();
        } else {
          tags = Tags();
        }
        tags.init(data, config);
        search.init();
        canvas.init(data, timeline, config); // Pass the timeline OBJECT here

        if (config.loader.layouts) {
          initLayouts(config);
        } else {
          canvas.setMode({
            title: "Time",
            type: "group",
            groupKey: "year"
          });
        }

        LoaderSprites()
          .progress(function (textures) {
            // Create a lookup map for faster access
            const dataMap = new Map(
              data
                .filter(d => d.sprite) // Ensure sprite exists
                .map(d => [d.id, d])
            );

            Object.keys(textures).forEach(id => {
              const item = dataMap.get(id);
              if (item) item.sprite.texture = textures[id];
            });
            canvas.wakeup();
          })
          //.finished() recalculate sizes
          .load(makeUrl(baseUrl.path, config.loader.textures.medium.url));
      });
    });
  });

  d3.select(window)
    .on("resize", function () {
      if (canvas !== undefined && tags !== undefined) {
        clearTimeout(window.resizedFinished);
        window.resizedFinished = setTimeout(function () {
          canvas.resize();
          tags.resize();
        }, 250);
      }
    })
    .on("keydown", function (e) {
      if (d3.event.keyCode != 27) return;
      search.reset();
      tags.reset();
      canvas.split();
    });

  d3.select(".filterReset").on("click", function () {
    // Immediately reset the tags
    tags.reset();
    // Then call canvas.resetZoom, which also triggers canvas.project internally
    canvas.resetZoom();
  });
  d3.select(".filterReset").on("dblclick", function () {
    console.log("dblclick");
    location.reload(); // Hard refresh for a full reset
  });

  d3.select(".slidebutton").on("click", function () {
    var s = !d3.select(".sidebar").classed("sneak");
    d3.select(".sidebar").classed("sneak", s);
  });

  d3.select(".infobutton").on("click", function () {
    var s = !d3.select(".infobar").classed("sneak");
    d3.select(".infobar").classed("sneak", s);
  });

  function initLayouts(config) {
    d3.select(".navi").classed("hide", false);

    config.loader.layouts.forEach((d, i) => {
      // legacy fix for time scales
      if (!d.type && !d.url) {
        d.type = "group"
        d.groupKey = "year"
      }
      if (d.type === "group" && i == 0) {
        canvas.setMode(d);
      } else if (d.url) {
        d3.csv(utils.makeUrl(baseUrl.path, d.url), function (tsne) {
          canvas.addTsneData(d.title, tsne, d.scale);
          if (i == 0) canvas.setMode(d);
        });
      }
    });

    if (config.loader.layouts.length == 1) {
      d3.select(".navi").classed("hide", true);
    }

    var s = d3.select(".navi").selectAll(".button").data(config.loader.layouts);
    s.enter()
      .append("div")
      .classed("button", true)
      .classed("space", (d) => d.space)
      .text((d) => d.title);

    s.on("click", function (d) {
      canvas.setMode(d);
      d3.selectAll(".navi .button").classed(
        "active",
        (d) => d.title == canvas.getMode().title
      );
    });
    d3.selectAll(".navi .button").classed(
      "active",
      (d) => d.title == config.loader.layouts[0].title
    );
  }
}

d3.select(".browserInfo").classed("show", utils.isMobile());
