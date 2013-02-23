dojo.provide("extras.Lens");

dojo.require("dijit._Widget");
dojo.require("dijit._Templated");

dojo.require("esri.map");
dojo.require("dojo.dnd.move");
dojo.require("dijit.form.ComboBox");
dojo.require("dijit.form.HorizontalSlider");
dojo.require("dijit.form.FilteringSelect");
dojo.require("dojo.data.ItemFileReadStore");

// url to location of namespace
// change url to web location of DIRECTORY containing this js file
//dojo.registerModulePath("swingley.dijit.Lens", "http://swingley.appspot.com/dijits/lens/");
dojo.declare("extras.Lens", [dijit._Widget, dijit._Templated], {

  templateString: '<div>' +
      '<div id="lensButton" dojoattachevent="onclick:toggleLens">' + 
        '<img id="lensIcon" src="' + dojo.moduleUrl("extras.Lens", "../images/zoom-32x32.png") + 
        '" />Lens ' + 
      '</div>' + 
      '<div id="lensWin">' + 
        '<div id="dragHandle">' + 
          '<span id="lensSettings">' + 
            '<label for="${id}.lensMapService">Map Service: </label>' +
            '<input id="${id}.lensMapService" />' + 
          '</span>' +
        '</div>' +
        '<div id="lensMap" style="height: 300px; width: 400px;">' +
          '<div style="position:absolute; left:10px; bottom:10px; z-Index:999;">' +
            '<div id="lensMapOpacity" dojoType="dijit.form.HorizontalSlider" showButtons="true" value="0" minimum="0" maximum="10" discreteValues="11" intermediateChanges="true" style="width:200px;">' +
              '<div dojoType="dijit.form.HorizontalRuleLabels" container="topDecoration" labels=" " style="position:relative; top:-1px; height:1.2em; font-size:80%; color:white; font-weight:bold;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>',
  widgetsInTemplate: true,
  mainMap: null,
  layerNames: null,
  started: false,

  constructor: function(params, srcRefNode){
    this.layerNames = []; // create an array to keep track of our layer names
    this.mainMap = params.map; // keep a reference to the page's primary map
    
    // add each layer name to an array that is a property of this widget 
    // also create a layer from each url as a property of this dijit
    // ternary operator is used to decide between tiled or dynamic map services
    // notice 3rd arg passed to forEach, it is the scope for the for loop
    dojo.forEach(params.layers, function(lyr, i) {
      (lyr.type == "Tiled") ? 
        this[lyr.name] = new esri.layers.ArcGISTiledMapServiceLayer(lyr.url, { "id": lyr.name }) : 
        this[lyr.name] = new esri.layers.ArcGISDynamicMapServiceLayer(lyr.url, { "id": lyr.name });
      this.layerNames[i] = lyr.name;
    }, this);
  },

  startup: function(){
    esri.config.defaults.map.panDuration = 0;
    esri.config.defaults.map.zoomDuration = 0;

    var map = this.mainMap;
    var center = (function() { var c = esri.geometry.webMercatorToGeographic(map.extent.getCenter()); return [parseFloat(c.x.toFixed(3)), parseFloat(c.y.toFixed(3))];}());
    // use the ID of the div in the lens window to create the lens map
    this.lensMap = new esri.Map("lensMap", { 
      center: center,
      zoom: this.mainMap.getLevel(),
      slider: false,
      showAttribution: false,
      logo: false
    });
    dojo.connect(this.lensMap, "onLoad", function(m) {
      dojo.attr(dojo.byId("lensMap"), "style", {height: "262px"}); 
      m.disableMapNavigation();
    }); 

    // add first layer that was passed in in the layers obj. so the lens displays something when it's opened
    this.lensMap.addLayer(this[this.layerNames[0]]);    

    // create and populate filtering select for the lens
    var lensOptions = {'identifier': 'name', 'label': 'name', 'items': []};
    dojo.forEach(this.layerNames, function(lyrName) {
      lensOptions.items.push({'name': lyrName});
    });
    
    var lensMapServiceOptions = new dojo.data.ItemFileReadStore({ data: lensOptions });
    var lensMapServiceFS = new dijit.form.FilteringSelect({
      displayedValue: this.layerNames[0],
      value: this.layerNames[0],
      name: "lensMapServiceFS", 
      required: false,
      store: lensMapServiceOptions, 
      searchAttr: "name",
      style: {'width': '100px', 'fontSize': '8pt', 'color': '#444'}
    }, this.id + ".lensMapService");

    // make the window appear in the center of the screen
    // subtract half the height and width of the div to get it centered
    var vertCenter = Math.floor(esri.documentBox.h / 2) - 227 + 'px';
    var horizCenter = Math.floor(esri.documentBox.w / 2) - 200 + 'px';
    dojo.attr('lensWin', "style", {top: vertCenter, left: horizCenter});

    // function to define the boundaries for the lens window
    // this is used in the constrainedMoveable constructor
    var mbFunction = function(){
      var coords = dojo.coords('map');
      b = {};
      b['t'] = 0;
      b['l'] = 0;
      b['w'] = coords.l + coords.w;  
      b['h'] = coords.h + coords.t + 20; // allow the bottom of the window to go 20px outside the viewport
      return b;
    }
    // make the window moveable
    this.draggableWin = new dojo.dnd.move.constrainedMoveable('lensWin', {
      handle: 'dragHandle',
      constraints: mbFunction,
      within: true
    });

    // set up listeners to keep the mini map synced with the main map
    dojo.connect(this.draggableWin, "onMove", dojo.hitch(this, this.syncLensExtent));
    dojo.connect(this.mainMap, "onExtentChange", dojo.hitch(this, this.syncLensExtent));
    dojo.connect(dijit.byId("lens.lensMapService"), "onChange", dojo.hitch(this, this.lensMapChange));
    dojo.connect(dijit.byId("lensMapOpacity"), "onChange", dojo.hitch(this, this.changeOpacity));
    
    this.started = true;
  },

  syncLensExtent: function() {
    // get the bounding box of the entire lens window
    var bb = dojo.coords(dojo.byId('lensWin')),
        dragHandleHeight = dojo.coords(dojo.byId('dragHandle')).h;

    // WebKit needs -2px off the top
    if ( dojo.isWebKit ) {
      dragHandleHeight = dragHandleHeight - 2;
    }
    // FF needs some 1px tweaking
    if ( dojo.isFF ) {
      dragHandleHeight = dragHandleHeight + 1;
      bb.l = bb.l - 1;
    }
    // IE needs some special attention as well
    if ( dojo.isIE ) {
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
    var opacity = 1.0 - (dijit.byId('lensMapOpacity').getValue() / 10);
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
    this.lensMap.getLayer(dijit.byId('lens.lensMapService').value).setOpacity(1.0 - newOp);
  },
  
  toggleLens: function(){
    //toggle the lens button icon
    var icon = dojo.byId('lensIcon');
    if ( icon.src.split('/').pop() == 'zoom-32x32.png' ){
      icon.src = dojo.moduleUrl("extras.lens", "../images/x-32x32.png");
    } else { 
      icon.src = dojo.moduleUrl("extras.lens", "../images/zoom-32x32.png");
    }
    
    //toggle the lens window
    var lensWin = dojo.byId('lensWin');
    if ( lensWin.style.display == '' || lensWin.style.display == 'none' ) {
      dojo.style('lensWin', 'display', 'block');  
      this.syncLensExtent(); // sync the extent
    } else { 
      dojo.style('lensWin', 'display', 'none'); 
    }
  }
});
