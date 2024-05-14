xy = null;
showPoint = null;
showLine = null;

$(document).ready(function () {
  var points = [];
  var markers = [];
  var polyline = null;
  var trafficLines = [];
  var tab = 0; // default status for navigation
  var map = L.map('map').setView([50.266667, 10.966667], 10);
  var greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  var redIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  showPoint = function(lat, lng) {
    L.marker([lat, lng], {icon: redIcon}).addTo(map);
  };

  showLine = function(points) {
    var polyline = L.polyline(points).addTo(map);
    map.fitBounds(polyline.getBounds());
  };

  xy = function(lat, lng, dist) {
    $.ajax({
      url: '/api/route/points?lat=' + (!!lat ? lat : '50.266667') +
      '&lon=' + (!!lng ? lng : '10.966667') + '&dist=' + (!!dist ? dist : 80),
      type: 'GET'
    }).done(function (data) {
      console.log(data.points);
      data.points.forEach(function (value) {
        console.log(value);
        L.marker([value[0], value[1]]).addTo(map);
      });
      map.fitBounds(data.points);
    });
  };

  // initialize map with mapbox tiles
  L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v10/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2VlZWJpaWkiLCJhIjoiY2l5NGpxc21wMDAxMTMycWg5ZWNlODg3MCJ9.l-3rv7-j3rxd8iSjIqZfqw', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18
  }).addTo(map);

  $('.tabs button').on('click', function () {
    let values = ["pois", "routing", "centroidsearch"]

    var buttonValue = $(this).val();

    for (let idx in values) {
      if ($('.tabs button[value="' + values[idx] + '"]').hasClass('active')) {
        $('.tabs button[value="' + values[idx] + '"]').removeClass('active');
        $('#' + values[idx]).hide();
      }
    }

    $('.tabs button[value="' + buttonValue + '"]').addClass('active');
    $('#' + buttonValue).show();

    tab = values.indexOf(buttonValue);

    if (tab === 2) {
      $('#ext_vehicle_select').show();
    }
    else {
      $('#ext_vehicle_select').hide();
    }
  });

  // register click and change handler
  map.on('click', function (e) {
    console.log('point: ', e.latlng);
    if (((tab === 0) && points.length >= 1) || (!(tab === 0) && points.length >= 2)) {
      resetMap();
    }

    addPointToMap(e.latlng, {icon: greenIcon});

    if ((points.length > 1) && (tab === 1)) {
      sendRouteRequest(points[0], points[1]);
    }
    else if ((points.length > 1) && (tab === 2)) {
      sendCentroidRequest(points[0], points[1]);
    }
  });

  $('#vehicle, #other_vehicle, #mode').on('change', function () {
    if (tab === 0) {
      return;
    }

    removePolyline();

    if ((points.length > 1) && (tab === 1)) {
      sendRouteRequest(points[0], points[1]);
    }
    else if ((points.length > 1) && (tab === 2)) {
      sendCentroidRequest(points[0], points[1]);
    }
  });

  $('button[name="search"]').on('click', function () {
    $('#error').hide();
    if (!(tab === 0)) {
      return;
    }

    if (points.length == 0) {
      $('#error').html('You have to select a point first.').show();
      return;
    }

    getPois();
  });

  $('button[name="route_search"]').on('click', function() {
    removePolyline();

    if (points.length > 1) {
      sendRouteRequest(points[0], points[1]);
    }
  });

  $('button[name="centroid_search"]').on('click', function() {
    removePolyline();

    if (points.length > 1) {
      sendCentroidRequest(points[0], points[1]);
    }
  });

  $('button[name="route_clear"]').on('click', function () {
    resetMap();
    $('#error').hide();
    $('#route_from').val('');
    $('#route_to').val('');
  });

  $('button[name="centroid_clear"]').on('click', function () {
    resetMap();
    $('#error').hide();
    $('#vehicle1').val('');
    $('#vehicle2').val('');
  });

  $('#poiTable').on('click', 'table tbody tr', function (e) {
    var elem = $(e.target).parent('tr');
    routeToPoi({
      latlng: points[parseInt(elem.attr('data-idx')) + 1]
    });
  });

  // helper functions
  function getPois() {
    removePolyline();
    removePointsExceptFirst();
    removeMarkersExceptFirst();
    $('#poiTable').empty().hide();
    var distance = $('#maxDistance').val();
    sendRequestToPois(points[0], distance);
  }

  function sendRequestToPois(startPoint, distance) {
    $('#error').hide();
    var url = '/api/pois?lat=' + startPoint.lat + '&lon=' + startPoint.lng + '&maxDistance=' + distance;
    if (startPoint.id) {
      url += '&pid=' + startPoint.id;
    }
    url += '&typeKey=' + $('#typeKey').val();
    url += '&typeValue=' + $('#typeValue').val();
    console.log('Sending request to: ', url);
    $.ajax({
      url: url,
      type: 'GET'
    }).done(function (success) {
      if (success && success.poiList) {
        if (success.poiList.length == 0) {
          $('#error').html('Could not find any POIs nearby. Please increase the distance or choose another POI type.').show();
        } else {
          removePoints();
          removeMarkers();
          addPointToMap(success.startPoint, {icon: greenIcon});
          var table = '<table><thead><th>#</th><th>Linear Distance (m)</th></thead><tbody>';
          for (var i = 0; i < success.poiList.length; i++) {
            addPointToMap(success.poiList[i], {clickHandler: routeToPoi});
            table += '<tr data-idx="' + i + '"><td>' + i + '</td><td>' + success.poiList[i][3] + '</td></tr>';
          }
          table += '</tbody></table>';
          $('#poiTable').show().html(table);
          map.fitBounds(points);
        }
      }
    }).fail(function (error) {
      $('#error').html('Something went wrong. Error message: ' + error.responseText).show();
      console.error('Error occurred while retrieving route between two points.', error);
    });
  }

  function routeToPoi(e) {
    // show routing tab
    $('.tabs button[value="routing"]').trigger('click');

    // do actual routing stuff
    var startPoint = points[0];
    var filtered = points.filter(function (value) {
      return (value[0] == e.latlng.lat && value[1] == e.latlng.lng) || (value.lat == e.latlng.lat && value.lng == e.latlng.lng);
    });
    var endPoint = filtered[0];
    removePolyline();
    removeMarkersExceptFirst();
    removePointsExceptFirst();
    $('#poiTable').empty().hide();
    addPointToMap(endPoint);
    sendRouteRequest(startPoint, endPoint);
  }

  function sendRouteRequest(startPoint, endPoint) {
    $('#error').hide();
    $('#route_from').val(pointToString(startPoint));
    $('#route_to').val(pointToString(endPoint));
    var url = getRouteRequestUrl(startPoint, endPoint);
    console.log('Sending request to: ', url);
    $.ajax({
      url: url,
      type: 'GET'
    }).done(function (success) {
      polyline = L.polyline(success.points, {color: 'blue'}).addTo(map);
      map.fitBounds(polyline.getBounds());

      $('#estimatedDistance').val(success.distance);
      $('#estimatedDistanceKm').val(Math.round((success.distance / 1000) * 100) / 100);
      var seconds = success.timeInSeconds;
      var date = new Date(null);
      date.setSeconds(seconds);
      $('#estimatedDuration').val(date.toISOString().substr(11, 8));
    }).fail(function (error) {
      $('#error').html('Something went wrong. Error message: ' + error.responseText).show();
      console.error('Error occurred while retrieving route between two points.', error);
    });
  }

  function sendCentroidRequest(posVehicle1, posVehicle2) {
    $('#error').hide();

    $('#vehicle1').val(pointToString(posVehicle1));
    $('#vehicle2').val(pointToString(posVehicle2));

    var url = getRouteRequestUrl(posVehicle1, posVehicle2);

    console.log('Sending request to: ', url);
    $.ajax({
      url: url,
      type: 'GET'
    }).done(function (success) {
      polyline = L.polyline(success.points, {color: 'blue'}).addTo(map);
      map.fitBounds(polyline.getBounds());

      $('#estimatedDistanceFrom1').val(success.distance);
      $('#estimatedDistanceFrom2').val(Math.round((success.distance / 1000) * 100) / 100);
      var seconds = success.timeInSeconds;
      var date = new Date(null);
      date.setSeconds(seconds);
      $('#estimatedDurationFrom1').val(date.toISOString().substr(11, 8));
      $('#estimatedDurationFrom2').val(date.toISOString().substr(11, 8));
    }).fail(function (error) {
      $('#error').html('Something went wrong. Error message: ' + error.responseText).show();
      console.error('Error occurred while retrieving route between two points.', error);
    });
  }

  function getRouteRequestUrl(startPoint, endPoint) {
    var start = getPointData(startPoint);
    var end = getPointData(endPoint);
    var params = '?lat1=' + start.lat + '&lon1=' + (start.lng || start.lon) + '&lat2=' + end.lat + '&lon2=' + (end.lng || end.lon);
    if (start.id) {
      params += '&pid1=' + start.id;
    }
    if (end.id) {
      params += '&pid2=' + end.id;
    }
    var vehicle = $('#vehicle').val();
    params += '&vehicle=' + vehicle;
    var mode = $('#mode').val();
    params += '&mode=' + mode;
    return '/api/route' + params;
  }

  function getPointData(point) {
    var isArray = Array.isArray(point);
    if (isArray) {
      return {
        lat: point[0],
        lng: point[1],
        id: point.length > 2 ? point[2] : -1
      };
    } else {
      return point;
    }
  }

  function resetMap() {
    removePolyline();
    removeMarkers();
    removePoints();
  }

  function removePoints() {
    points = [];
  }

  function removePointsExceptFirst() {
    if (points.length == 1) {
      return;
    }

    // removes all elements except the first one
    points.splice(1, points.length);
  }

  function removeMarkers() {
    for (var i = 0; i < markers.length; i++) {
      map.removeLayer(markers[i]);
    }
    markers = [];
  }

  function removeMarkersExceptFirst() {
    if (markers.length == 1) {
      return;
    }

    // removes all elements except the first one
    for (var i = 1; i < markers.length; i++) {
      map.removeLayer(markers[i]);
    }
    markers.splice(1, markers.length);
  }

  function removePolyline() {
    if (polyline != null) {
      map.removeLayer(polyline);
    }
  }

  function addPointToMap(point, options) {
    options = options || {};
    var markerPoint = null;

    if (Array.isArray(point)) {
      markerPoint = {
        lat: point[0],
        lng: point[1],
        id: point.length > 2 ? point[2] : -1,
        estimatedDistance: point.length > 3 ? point[3] : 0
      };
      points.push(markerPoint);
    } else {
      markerPoint = {
        lat: point.lat,
        lng: point.lng || point.lon,
        id: point.id || -1,
        estimatedDistance: point.estimatedDistance || -1
      };
      points.push(markerPoint);
    }

    var marker = null;

    if (options.icon) {
      marker = L.marker(markerPoint, {icon: options.icon});
    } else {
      marker = L.marker(markerPoint);
    }

    if (options.clickHandler) {
      marker.on('click', options.clickHandler);
    }

    markers.push(marker.addTo(map));
  }

  function pointToString(point) {
    if (!!point && Array.isArray(point) && point.length >= 2) {
      return point[0] + ', ' + point[1];
    } else if (!!point && point.lat && (point.lng || point.lon)) {
      return point.lat + ', ' + (point.lng || point.lon);
    } else {
      return 'Missing point data.';
    }
  }

  function getMetaData() {
    $.ajax({
      url: '/api/meta/system',
      type: 'GET'
    }).done(function (result) {
      var footerText = 'Server started with data from file <i>' + result.osmFile + '</i>.';
      footerText += ' Nodes: ' + result.nodes + ', Edges: ' + result.edges;
      $('#footer').html(footerText);
    }).fail(function (error) {
      console.log('error occurred while retrieving meta data from server.', error);
    });
  }

  function getPoiOptions() {
    $.ajax({
      url: '/api/pois',
      type: 'OPTIONS'
    }).done(function (result) {
      // add keys to select
      var keys = Object.keys(result);
      var typeKey = $('#typeKey');
      keys.sort().forEach(function (value) {
        typeKey.append('<option>' + value + '</option>')
      });

      // add click handler to change values appropriately
      typeKey.on('click', function (e) {
        var key = $(this).val();
        var values = result[key];
        var typeValue = $('#typeValue');
        typeValue.empty();
        values.sort().forEach(function (value) {
          typeValue.append('<option>' + value + '</option>');
        });
      });

      // trigger a click to add initial values
      typeKey.trigger('click');
    }).fail(function (error) {
      console.log('error occurred while retrieving POI types from server.', error);
    });
  }


  function setupTmc() {
    var select = $('#tmcSelect');

    var beforeTrafficRequest = function () {
      $('#tmcLoadingBlanket').show();
      for (var i = 0; i < trafficLines.length; i++) {
        map.removeLayer(trafficLines[i]);
      }

      select.attr('disabled', 'disabled');
    };

    var handleTrafficData = function (result) {
      for (var i = 0; i+1 < result.points.length; i += 2) {
        var p1 = result.points[i];
        var p2 = result.points[i+1];
        var polyline = L.polyline([p1, p2], {color: 'red', weight: 10}).addTo(map);
        trafficLines.push(polyline);
      }
      select.removeAttr('disabled');
      $('#tmcLoadingBlanket').hide();
    };

    var handleTmcError = function (error) {
      $('#error').html('Something went wrong when retrieving TMC data. Error message: ' + error.responseText).show();
    };

    var setupTmcHandler = function() {
      $('#useTmc').on('change', function(e) {
        if ($(this).is(':checked')) {
          beforeTrafficRequest();
          $.ajax({
            url: '/api/traffic/' + select.val(),
            type: 'PUT'
          }).done(handleTrafficData).fail(handleTmcError);
        } else {
          select.attr('disabled', 'disabled');
          beforeTrafficRequest();
          $.ajax({
            url: '/api/traffic',
            type: 'DELETE'
          }).done(function(result) {
            $('#tmcLoadingBlanket').hide();
          }).fail(handleTmcError);
        }
      });
    };

    var buildTmcOptions = function() {
      var html = '';
      for (var i = 0; i < 24; i++) {
        html += '<option>' + i + '</option>';
      }
      select.html(html);
      select.on('change', function(e) {
        beforeTrafficRequest();
        $.ajax({
          url: '/api/traffic/' + select.val(),
          type: 'PUT'
        }).done(handleTrafficData).fail(handleTmcError);
      });
    };

    var initTmcStatus = function () {
      $('#tmcLoadingBlanket').show();
      $.ajax({
        url: '/api/traffic',
        type: 'GET'
      }).done(function(result) {
        buildTmcOptions();
        setupTmcHandler();
        $('#tmcLoadingBlanket').hide();

        if (result.hour < 0) {
          $('#useTmc').prop('checked', false);
          select.attr('disabled', 'disabled');
        } else {
          $('#useTmc').prop('checked', true);
          select.val(result.hour);
          handleTrafficData(result);
        }
      }).fail(handleTmcError);
    };

    initTmcStatus();
  }

  getMetaData();
  getPoiOptions();
  setupTmc();
});