// Function to generate a random number between two values
function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to generate a random horizontal offset (0, 1, or 2 vw)
function getRandomOffset() {
  const offsets = [-2,-1,0,1,2]; // Possible offsets in vw
  return offsets[Math.floor(Math.random() * offsets.length)];
}

window.backgroundGenerator = function (fromSub) {
  const elems = 7;
  const totalImages = elems * elems;
  let prefix = ""
  if(fromSub) {
    prefix = '../';
  }
  const shapes = ["Bean","Pill","Square","Pacman"];
  const colours = ["Blue","Green","Magenta","Orange","Purple"];

  let shape = shapes[Math.floor(getRandom(0,shapes.length))]
  // Create initial grid of symbols
  for (let i = 0; i < totalImages; i++) {
    let img = document.createElement('img');
    img.src = prefix + "Styling/" +  colours[Math.floor(getRandom(0,colours.length))] + shape +".svg";

    img.classList.add('background-image');

    // Calculate the row and column
    let row = Math.floor(i / elems);
    let col = i % elems;

    // Calculate the position with offset for each image
    let positionX = ((100/elems)/3) + (col * (100/elems)) + getRandomOffset(); // 1/7th of the width + random offset
    let positionY = ((100/elems)/8) + (row * (100/elems)) + getRandomOffset(); // 1/7th of the height + random offset

    // Set the image's position on the screen
    img.style.left = `${positionX}vw`;
    img.style.top = `${positionY}vh`;

    if(shape === "Square"){
      img.style.width = `${getRandom(2, 5)}vw`;
    } else {
      img.style.width = `${getRandom(3, 6)}vw`;
    }

    img.style.transform = `rotate(${getRandom(0, 360)}deg)`; // Random rotation from 0 to 360 degrees
    document.body.appendChild(img); // Append the image to the body
  }
};