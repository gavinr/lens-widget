# lens-widget

The lens widget is a draggable window within a web app that is used to display other map services on top of an existing map service. [Demo:  Lens Widget](http://swingley.github.com/lens-widget/)

ArcMap has overview/magnifier windows and there are similar tools available for Esri's other web APIs (flex and silverlight). [Cartifact Maps also has a cool lens widget on their site](http://maps.cartifact.com/lany/). Finally, there's also a lens type tool in the examples that are bundled with PolyMaps. This widget provides similar functionality for the ArcGIS API for JavaScript.

The widget is created from a page that includes an ArcGIS API for JavaScript map. The widget takes two arguments:
-a map (this is the base map sits under the lens)
-an array of objects that contain information about each map service to be displayed in the lens 

When the widget's init method is called, the widget loops through the array of map services and creates layers out of them. The widget also builds a filtering select to let a user select which map service should be displayed in the lens window. The final component of the lens window is a horizontal slider that lets you control the transparency of the layer being displayed in the lens window.

The lens widget works with both tiled and dynamic map services. For performance reasons, tiled services are preferred.

## Instructions

1. Fork and then clone the repo (preferably to a directory accessible to a web server)
2. Load lens-widget/index.html in a browser
3. Click the "Lens" button in the upper right corner of the page

## Requirements

* All map services must be in the same spatial reference
* Notepad or your favorite HTML editor
* Web browser with access to the Internet

## Resources

* [ArcGIS for JavaScript API Resource Center](http://esriurl.com/js)
* [@derekswingley](http://twitter.com/derekswingley)

## Issues

Find a bug or want to request a new feature?  Please let us know by submitting an issue.

## Contributing

Anyone and everyone is welcome to contribute. 

## TODO

* move template string to separate .html file
* use data-dojo-attach-point in template and get rid of dijit.byId calls
* convert to AMD
* check that the lens map service SR matches the map's SR
* check for map.loaded within the widget so it's not necessary to connect map.onLoad to use the widget


## Licensing
Copyright 2013 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[](Esri Tags: JavaScript ArcGIS API Mapping Widget Lens)
[](Esri Language: JavaScript)​
