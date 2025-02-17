/*
* Author: MrFuzzyPants11
* Created: July 28 2024
* Last Modified: August 2nd 2024
* Description: Main JS for making an modifying video list on website
*/

console.log("Video Lister loaded");
let videoList = [];
const blockOrText = false; // True for block colouring, false for text colouring.


/**
 * Event listeners for sorting buttons
 */
document.getElementById('submissionSort').addEventListener('click', function() {
  //console.log("Sorting by submission amount");
  SortSubmissions();
  displayVideoList();
});
document.getElementById('durationSort').addEventListener('click', function() {
  //console.log("Sorting by duration");
  SortDuration();
  displayVideoList();
});
document.getElementById('refreshSort').addEventListener('click', function() {
  //console.log("Refreshing list");
  refresh();
  displayVideoList();
});

/**
 * Function to change channel name
 */
function saveInput() {
  const channelName = document.getElementById("channelName").value;

  console.log("Updated channel name to: " + channelName)
  
  document.getElementById("channelName").placeholder = "Refresh to reset";
  document.getElementById("channelName").value = "";

  setupClient(channelName);
}

function setupClient(channelName) { // Setup TMI to listen to Twitch Chat
  const client = new tmi.Client({
    channels: [channelName],
  });

  client.connect();
  //console.log("Channel attached");
  client.on("message", (channel, tags, message, self) => { // Run each time a chat comes in
    //console.log("Message Recieved");
    let url = extractYouTubeURL(message)
    let videoID = getvideoIDFromUrl(url);
    if (videoID) {
      fetchVideoInfo(videoID,url);
    }
  });
}

/**
 * Extracts the youtube url from any given text if preset
 * @param text the message text to extract from
 * @return the youtube url or null if no youtube url present.
 */
function extractYouTubeURL(text) {
  // Regular expression to match both youtube.com and youtu.be URLs
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
  const match = text.match(urlPattern);
  
  if (match) {
    // Check if it's a standard YouTube URL or a shortened URL
    if (match[1].startsWith("youtube.com")) {
      return `https://www.youtube.com/watch?v=${match[2]}`;
    } else if (match[1].startsWith("youtu.be")) {
      return `https://youtu.be/${match[2]}`;
    }
  }
  return null;
}

/**
 * Gets the Video ID from the url
 * @param url the url to extract ID from
 * @return video ID or null if no ID present.
 */
function getvideoIDFromUrl(url) {
  //console.log("Getting video ID");
  if (!url) return null;
  url = url.replace(/&t=\d+s/, '');
  url = url.replace(/&t=\d/, '');
  const urlObj = new URL(url);
  if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
    return urlObj.searchParams.get('v');
  } else if (urlObj.hostname === 'youtu.be') {
    return urlObj.pathname.substring(1);
  }
  return null;
}

/**
 * Gets the video information from the youtube API
 * @param videoID ID of the video
 * @param url simply passed through this function for function call simplification
 */
function fetchVideoInfo(videoID, url) {
  //console.log("Getting video info");
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoID}&key=AIzaSyCwSHvZBToshLMY5NoHqq_knHIEfzWrM4c`;
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      if (data.items.length > 0) {
        const video = data.items[0];
        addOrUpdateVideoList(video, videoID, url);
      }
    })
    .catch(error => console.error('Error fetching video info:', error));
}

/**
 * Gets the video information from the youtube API
 * @param video all the video information just found
 * @param videoID ID of the video for duplicate submission checking
 * @param url url to attach to the div element later
 */
function addOrUpdateVideoList(video, videoID, url) {
  //console.log("Adding or updating video list");
  const existingVideo = videoList.find(v => v.videoID === videoID);
  if (existingVideo) {
    existingVideo.submissionCount += 1;
  } else {
    const videoInfo = {
      videoID: videoID,
      url: url,
      thumbnail: video.snippet.thumbnails.high.url,
      title: video.snippet.title,
      channel: video.snippet.channelTitle,
      duration: parseDuration(video.contentDetails.duration),
      views: video.statistics.viewCount,
      submissionCount: 1
    };
    videoList.push(videoInfo);
  }
  displayVideoList();
}

/**
 * This takes the previously created video items and constructs their Divs.
 */
function displayVideoList() {
  //console.log("Sending info to site");
  const videoListContainer = document.getElementById('video-list');
  videoListContainer.innerHTML = '';

  videoList.forEach(video => {
    const videoItem = document.createElement('div');
    videoItem.classList.add('video-item');
    
    // Video Thumbnail
    const videoThumbnail = document.createElement('img');
    videoThumbnail.src = video.thumbnail;
    videoThumbnail.alt = 'Video Thumbnail';
    videoThumbnail.classList.add('video-thumbnail');
    videoItem.appendChild(videoThumbnail);
    
    // Video Details
    const videoDetails = document.createElement('div');
    videoDetails.classList.add('video-details');
    
    const videoTitle = document.createElement('h2');
    videoTitle.textContent = video.title;
    videoDetails.appendChild(videoTitle);

    const videoChannel = document.createElement('p');
    videoChannel.classList.add('video-channel');
    videoChannel.textContent = video.channel;
    videoDetails.appendChild(videoChannel);

    const videoSubmissions = document.createElement('p');
    videoSubmissions.classList.add('video-submitted');
    videoSubmissions.textContent = `${video.submissionCount} Submissions`;
    videoDetails.appendChild(videoSubmissions);
    videoItem.appendChild(videoDetails);

    // Video Duration/views
    const videoDurationField = document.createElement('div');
    videoDurationField.classList.add('video-duration-field');
    const videoDuration = document.createElement('p');
    videoDuration.classList.add('video-duration');
    if(blockOrText){
      videoItem.style.backgroundColor = getDurationColour(video.duration);
      videoItem.style.borderBottomColor = getDurationBottomColour(video.duration)
    } else {
      videoDuration.style.color = getDurationColour(video.duration);
    }

    videoDuration.textContent = video.duration;
    videoDurationField.appendChild(videoDuration);

    const videoViews = document.createElement('p');
    videoViews.classList.add('video-views');
    videoViews.textContent = `${video.views} Views`;
    videoDurationField.appendChild(videoViews);
    videoItem.appendChild(videoDurationField);
    
    videoItem.addEventListener('click', () => {
      window.open(video.url, '_blank');
    });


    videoListContainer.appendChild(videoItem);
  });
}

/**
 * Parses out a text version of the duration
 * @param duration the youtube video's duration in time format
 * @return the duration as text
 */
function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = match[1] ? match[1].slice(0, -1).padStart(2, '0') : '00';
  const minutes = match[2] ? match[2].slice(0, -1).padStart(2, '0') : '00';
  const seconds = match[3] ? match[3].slice(0, -1).padStart(2, '0') : '00';
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Returns a colour to set the text of the duration or block given the video's length
 * @param duration the youtube video's duration in time format
 * @return the colour as text
 */
function getDurationColour(duration) {
  const parts = duration.split(':');
  const totalMinutes = parts.length === 3 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : parseInt(parts[0]);
  if (totalMinutes <= 20) {
    return '#3cb371'; // Green
  } else if (totalMinutes <= 40) {
    return '#ff6b00'; // Orange
  } else {
    return '#b22222'; // Red
  }
}

/**
 * Returns a colour to set the bottom border of the block given the video's length
 * @param duration the youtube video's duration in time format
 * @return the colour as text
 */
function getDurationBottomColour(duration) {
  const parts = duration.split(':');
  const totalMinutes = parts.length === 3 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : parseInt(parts[0]);
  if (totalMinutes <= 20) {
    return '#2f8d59'; // Green
  } else if (totalMinutes <= 40) {
    return '#cc5600'; // Orange
  } else {
    return '#871a1a'; // Red
  }
}

/**
 * Sorts videoList from most  to least submission
 */
function SortSubmissions(){
  videoList.sort((a, b) => b.submissionCount - a.submissionCount);
}

/**
 * Sorts videoList from shortest to longest
 */
function SortDuration() {
  videoList.sort((a, b) => {
    const durationA = parseDurationToSeconds(a.duration);
    const durationB = parseDurationToSeconds(b.duration);
    return durationA - durationB;
  });
}

/**
 * Used to return total number of seconds for SortDuration()
 * @param duration duration of video
 * @return total seconds of video
 */
function parseDurationToSeconds(duration) {
  const parts = duration.split(':');
  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds += parseInt(parts[0]) * 3600; // hours to seconds
    totalSeconds += parseInt(parts[1]) * 60;   // minutes to seconds
    totalSeconds += parseInt(parts[2]);        // seconds
  } else if (parts.length === 2) {
    totalSeconds += parseInt(parts[0]) * 60;   // minutes to seconds
    totalSeconds += parseInt(parts[1]);        // seconds
  }
  return totalSeconds;
}

/**
 * Refresh/clears video list
 */
function refresh() {
  videoList = [];
}