// Put footer at the bottom.
$('#body').css({
  minHeight: $(window).height() - $('header').outerHeight() - $('footer').outerHeight() - 1
});

$(function(){
  // Show "phone's" if it's a phone.
  $('#use-my-address .phone').toggle($.browser.mobile);
});

// Use My Address click handler.
$('#use-my-address').click(function() {
  if (!("geolocation" in navigator)) {
    alert("Location is not available.");
    return;
  }
  ga('send', 'event', 'Interactions', 'location', 'geolocation');
  modal_operation(function(operation_finished) {
    navigator.geolocation.getCurrentPosition(function(position) {
      // Sometimes it comes back with the MaxMind center of the U.S.
      // at 38, -97. Don't allow that. See http://fusion.net/story/287592/internet-mapping-glitch-kansas-farm/.
      // We also see 37.09024, -95.71289 in the wild. So use a large
      // enough tolerance.
      var dist_from_us_center = Math.pow(Math.pow(position.coords.latitude - 38, 2) + Math.pow(position.coords.longitude - -97, 2), .5);
      if (dist_from_us_center < 2.5) {
        operation_finished();
        alert("Your location is not available.");
        return;
      }

      // Pass the location to the backend to get the congressional
      // district.
      geocode({
        longitude: position.coords.longitude,
        latitude: position.coords.latitude
        });
      operation_finished(); // do this after we start the geocode ajax call so that the modal stays up
    }, function(err) {
      operation_finished();
      alert("Your location is not available.");
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    });
  });
})

function geocode(data, go_next) {
  ajax_with_indicator({
    method: "POST",
    url: "/_geocode",
    data: data,
    success: function(res) {
      localStorage.setItem('geocode', JSON.stringify(res));
      onHasGeocode(res);
      if (go_next)
        onTopicSubmit();
    }
  })
}

function reset_address() {
  $('#homepage-district').hide();
  $('#homepage-address').show();
  localStorage.setItem('geocode', '');
  reset_topic();
}

$(function() {
  // Have existing geocode info?
  var res = localStorage.getItem("geocode");
  if (res) {
    try {
      ga('send', 'event', 'Interactions', 'location', 'returning-user');
      onHasGeocode(JSON.parse(res));
    } catch (ex) {
    }
  }

  // URL specifies topic?
  var qs = parse_qs(window.location.hash.substring(1));
  if (qs.topic)
    $('#topic').val(qs.topic);
})

$('#topic-go').click(function() {
  if ($('#address').is(":visible")) {
    // Address entry is still shown - use it.
    submit_address();
  } else {
    // Already geocoded.
    onTopicSubmit();
  }
})

function submit_address() {
  var address = $('#address').val();
  if (!address) {
    alert("Enter your home address so we can find who represents you in Congress.");
    return;
  }
  ga('send', 'event', 'Interactions', 'location', 'address');
  geocode({
    address: address
  }, true);
}

var geocode_data = null;
function onHasGeocode(geocode) {
  geocode_data = geocode;
  $('#homepage-address').hide()
  $('#homepage-district').fadeIn();
  $('#homepage-district').find('.state').text(geocode.state);
  $('#homepage-district').find('.district').html(geocode.district_html);
  $('#homepage-district').find('.address').text(geocode.address);
  $('#district-link').attr('href',
    'https://www.govtrack.us/congress/members/'
    + geocode.cd.substring(0, 2)
    + "/"
    + parseInt(geocode.cd.substring(2)));
}

$('#topic').change(function() {
  // Update URL.
  var topic = $('#topic').val();
  if (topic == "")
    history.replaceState(null, null, "#")
  else
    history.replaceState(null, null, "#topic=" + topic)

  // If a topic was already shown, update it.
  if (topic && $('#homepage-action').is(":visible"))
    onTopicSubmit();
});

function onTopicSubmit() {
  var topic = $('#topic').val();
  if (topic == "") {
    alert("Select a topic.");
    return;
  }
  if (!geocode_data.cd) { // validate we have the data we need
    alert("Pleae re-enter your address.");
    return;
  }

  // Add the auto-campaign prefix.
  var prefix = $('#topic').data("topic-root");
  if (prefix)
    topic = prefix + "/" + topic;

  // Track event.
  ga('send', 'event', 'Interactions', 'get-instructions', 'topic:'+topic);

  // Get call script.
  ajax_with_indicator({
    method: "POST",
    url: "/_action",
    data: {
      campaign: topic,
      user: JSON.stringify(geocode_data)
    },
    success: function(res) {
      //console.log(res);
      $('#topic-go').hide();
      $('#homepage-action').fadeIn();
      $('#homepage-action>div.script').html(res.html);
    }
  })
}

function reset_topic() {
   $('#homepage-action').hide();
   $('#topic-go').show();
}

$('#i-did-it').click(function() {
  var topic = $('#topic').val();
  ga('send', 'event', 'Goal', 'completed-action', 'topic:'+topic);
  reset_topic();
  alert("Awesome!!")
});

$('#i-didnt-do-it').click(function() {
  var topic = $('#topic').val();
  ga('send', 'event', 'Interactions', 'didntdoit', 'topic:'+topic);
  reset_topic();
});
