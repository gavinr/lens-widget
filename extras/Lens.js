define([
  "dojo/_base/declare", 
  "dojo/_base/array", 
  "dojo/_base/connect", 
  "dojo/_base/html",
  "dojo/_base/lang",

  "dojo/sniff", 
  "dojo/has",
  "dojo/dnd/move",
  "dojo/data/ItemFileReadStore",

  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-style",

  "dijit/_WidgetBase", 
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",

  "dijit/registry",
  "dijit/form/ComboBox",
  "dijit/form/HorizontalSlider",
  "dijit/form/HorizontalRuleLabels",
  "dijit/form/FilteringSelect",

  "dojox/gfx",

  "dojo/text!extras/templates/lens.html",

  "esri/map",
  "esri/layers/agstiled"
], function(
  declare, array, connect, html, lang, 
  sniff, has, move, ItemFileReadStore, 
  dom, domAttr, domStyle,
  WidgetBase, TemplatedMixin, WidgetsInTemplateMixin,
  registry, ComboBox, HorizontalSlider, HorizontalRuleLabels, FilteringSelect,
  gfx,
  template
) {
  var LENS = declare([WidgetBase, TemplatedMixin, WidgetsInTemplateMixin], {
    
    templateString: template,

    lensMap: null,
    mainMap: null,
    layerNames: null,
    started: false,

    iconMagnifier: null,
    iconX: null,
    iconCurrent: null,
    iconSurface: null,

    constructor: function(params, srcNodeRef){
      this.layerNames = []; // create an array to keep track of our layer names
      this.mainMap = params.map; // keep a reference to the page's primary map
      
      // add each layer name to an array that is a property of this widget 
      // also create a layer from each url as a property of this dijit
      // ternary operator is used to decide between tiled or dynamic map services
      // notice 3rd arg passed to forEach, it is the scope for the for loop
      array.forEach(params.layers, function(lyr, i) {
        (lyr.type === "Tiled") ? 
          this[lyr.name] = new esri.layers.ArcGISTiledMapServiceLayer(lyr.url, { "id": lyr.name }) : 
          this[lyr.name] = new esri.layers.ArcGISDynamicMapServiceLayer(lyr.url, { "id": lyr.name });
        this.layerNames[i] = lyr.name;
      }, this);

      this.iconMagnifier = "M29.772,26.433l-7.126-7.126c0.96-1.583,1.523-3.435,1.524-5.421C24.169,8.093,19.478,3.401,13.688,3.399C7.897,3.401,3.204,8.093,3.204,13.885c0,5.789,4.693,10.481,10.484,10.481c1.987,0,3.839-0.563,5.422-1.523l7.128,7.127L29.772,26.433zM7.203,13.885c0.006-3.582,2.903-6.478,6.484-6.486c3.579,0.008,6.478,2.904,6.484,6.486c-0.007,3.58-2.905,6.476-6.484,6.484C10.106,20.361,7.209,17.465,7.203,13.885z";
      this.iconX = "M24.778,21.419 19.276,15.917 24.777,10.415 21.949,7.585 16.447,13.087 10.945,7.585 8.117,10.415 13.618,15.917 8.116,21.419 10.946,24.248 16.447,18.746 21.948,24.248";
    },

    postCreate: function() {
      this.inherited(arguments);
      // create the vector icon
      // using postCreate because the gfx stuff can be done before
      // the widget structure is in the DOM
      this.iconSurface = gfx.createSurface(this.lensIconVector);
      this.iconSurface.whenLoaded(lang.hitch(this, function(surface) {
        surface.createPath(this.iconMagnifier).setFill("#666");
        this.iconCurrent = "magnifier";
      }));
    },

    startup: function(){
      esri.config.defaults.map.panDuration = 0;
      esri.config.defaults.map.zoomDuration = 0;

      var map = this.mainMap;
      var center = (function() { var c = esri.geometry.webMercatorToGeographic(map.extent.getCenter()); return [parseFloat(c.x.toFixed(3)), parseFloat(c.y.toFixed(3))];}());
      // use the attach point in the template to get 
      // the node to turn into the lens map
      this.lensMap = new esri.Map(this.lensMapNode, { 
        center: center,
        zoom: this.mainMap.getLevel(),
        slider: false,
        showAttribution: false,
        logo: false
      });
      connect.connect(this.lensMap, "onLoad", lang.hitch(this, function() {
        this.lensMap.disableMapNavigation();
      })); 

      // add first layer that was passed in in the layers obj. 
      // so the lens displays something when it's opened
      this.lensMap.addLayer(this[this.layerNames[0]]);

      // create and populate filtering select for the lens
      var lensOptions = {"identifier": "name", "label": "name", "items": []};
      array.forEach(this.layerNames, function(lyrName) {
        lensOptions.items.push({"name": lyrName});
      });
      
      var lensMapServiceOptions = new ItemFileReadStore({ data: lensOptions });
      this.lensMapServiceFS = new FilteringSelect({
        displayedValue: this.layerNames[0],
        value: this.layerNames[0],
        // name: "lensMapServiceFS", 
        required: false,
        store: lensMapServiceOptions, 
        searchAttr: "name",
        style: {"width": "100px", "fontSize": "8pt", "color": "#444"}
      }, this.lensMapService);

      // make the window appear in the center of the screen
      // subtract half the height and width of the div to get it centered
      var vertCenter = Math.floor(esri.documentBox.h / 2) - 227 + "px";
      var horizCenter = Math.floor(esri.documentBox.w / 2) - 200 + "px";
      domStyle.set(this.lensWin, { top: vertCenter, left: horizCenter });

      // function to define the boundaries for the lens window
      // this is used in the constrainedMoveable constructor
      var mbFunction = function() {
        var coords = html.coords("map");
        var b = {};
        b.t = 0;
        b.l = 0;
        b.w = coords.l + coords.w;  
        b.h = coords.h + coords.t + 20; // allow the bottom of the window to go 20px outside the viewport
        return b;
      };
      // make the window moveable
      this.draggableWin = new move.constrainedMoveable(this.lensWin, {
        handle: this.dragHandle,
        constraints: mbFunction,
        within: true
      });

      // set up listeners to keep the mini map synced with the main map
      connect.connect(this.draggableWin, "onMove", lang.hitch(this, this.syncLensExtent));
      connect.connect(this.mainMap, "onExtentChange", lang.hitch(this, this.syncLensExtent));
      connect.connect(this.lensMapServiceFS, "onChange", lang.hitch(this, this.lensMapChange));
      connect.connect(registry.byId("lensMapOpacity"), "onChange", lang.hitch(this, this.changeOpacity));
      connect.connect(this.lensButton, "onclick", lang.hitch(this, this.toggleLens));
      
      this.started = true;
    },

    syncLensExtent: function() {
      // get the bounding box of the entire lens window
      var bb = html.coords(this.lensWin),
          dragHandleHeight = html.coords(this.dragHandle).h;

      // WebKit needs -2px off the top
      if ( sniff("webkit") ) {
        dragHandleHeight = dragHandleHeight - 2;
      }
      // FF needs some 1px tweaking
      if ( sniff("ff") ) {
        dragHandleHeight = dragHandleHeight + 1;
        bb.l = bb.l - 1;
      }
      // IE needs some special attention as well
      if ( sniff("ie") ) {
        dragHandleHeight = dragHandleHeight - 4;
      }

      // create new extent for the lens map
      // lower-left x and y, add 428 to the y coordinate get to the minimum y
      // the height of the map is actually still 400 and we need to account for the 28px drag hangle
      var ll = this.mainMap.toMap(new esri.geometry.Point(bb.l, bb.t + 428, this.mainMap.spatialReference));
      // upper-right x and y
      // add dragHandle height to the y coordinate to account for the drag-handle div
      var ur = this.mainMap.toMap(new esri.geometry.Point(bb.l + bb.w, bb.t + dragHandleHeight, this.mainMap.spatialReference));
      var newExtent = new esri.geometry.Extent(ll.x, ll.y, ur.x, ur.y, this.mainMap.spatialReference);
      this.lensMap.setExtent(newExtent);
    },  

    lensMapChange: function(newMapService) {
      // figure out the opacity so we can apply it to the new layer
      // so we don't have to reset the opacity slider
      var opacity = 1.0 - (registry.byId("lensMapOpacity").getValue() / 10);
      this.lensMap.removeAllLayers(); // remove all layers from the lens window before adding a new one
      // commenting out the check for map service wkid ... ONLY ADD MAP SERVICES WITH THE SAME SRID.
      //if ( this[newMapService].spatialReference.wkid == this.lensMap.spatialReference.wkid ) {
      this.lensMap.addLayer(this[newMapService]).setOpacity(opacity);
      //} else {
        //console.log('New layer\'s SR doesn\'t match the map\'s SR\nThe map\'s SR is ', this.lensMap.spatialReference.wkid, ' and the new layer\'s SR is ', this[newMapService].spatialReference.wkid);
        //alert('Unable to add ' + newMapService + ' because it\'s spatial reference does not match the underlying map. \nPlease select a different layer.');
      //}
    },
    
    changeOpacity: function(op){
      var newOp = (op / 10);
      // there is only ever one layer in the lens map so 
      // using getLayer('layer0') should always work
      this.lensMap.getLayer(this.lensMapServiceFS.value).setOpacity(1.0 - newOp);
    },
    
    toggleLens: function() {
      //toggle the lens button icon
      this.iconSurface.clear();
      if ( this.iconCurrent === "magnifier" ) {
        this.iconSurface.createPath(this.iconX).setFill("#666");
        this.iconCurrent = "x";
      } else { 
        this.iconSurface.createPath(this.iconMagnifier).setFill("#666");
        this.iconCurrent = "magnifier";
      }
      
      //toggle the lens window
      // var lensWin = dom.byId("lensWin");
      if ( this.lensWin.style.display == "" || this.lensWin.style.display == "none" ) {
        domStyle.set(this.lensWin, "display", "block");  
        this.syncLensExtent(); 
      } else { 
        domStyle.set(this.lensWin, "display", "none"); 
      }
    }

  });
  return LENS;
});
