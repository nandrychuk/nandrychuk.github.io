// Function to generate a random number between two values
function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to generate a random horizontal offset (0, 1, or 2 vw)
function getRandomOffset() {
  const offsets = [0, 1, 2]; // Possible offsets in vw
  return offsets[Math.floor(Math.random() * offsets.length)];
}

window.backgroundGenerator = function (fromSub) {
  // Load 36 random images and position them in a grid with random offsets
  const rows = 7;
  const cols = 7;
  const totalImages = rows * cols;

  for (let i = 0; i < totalImages; i++) {
    let img = document.createElement('img');
    if(fromSub) {
      img.src = '../Styling/test_squiggle.svg'; // Path to your SVG image
    } else {
      img.src = 'Styling/test_squiggle.svg'; // Path to your SVG image
    }
    img.classList.add('trippy'); // Apply the class for animations

    // Calculate the row and column
    let row = Math.floor(i / cols); // Row number (0 to 5)
    let col = i % cols; // Column number (0 to 5)

    // Calculate the position (in vw units) for each image
    let positionX = (col * (100/rows)) + getRandomOffset(); // 1/6th of the width + random offset
    let positionY = (row * (100/rows)) + getRandomOffset(); // 1/6th of the height

    // Set the image's position on the screen
    img.style.left = `${positionX}vw`;
    img.style.top = `${positionY}vh`;

    img.style.width = `${getRandom(4, 10)}vw`;

    img.style.transform = `rotate(${getRandom(0, 360)}deg)`; // Random rotation from 0 to 360 degrees
    // Append the image to the body
    document.body.appendChild(img);
  }
};