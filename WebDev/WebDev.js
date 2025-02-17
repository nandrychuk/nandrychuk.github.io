// Select all elements with the class 'expandable'
const expandableDivs = document.querySelectorAll(".rectangle");

// Loop through each element and attach the click event listener
expandableDivs.forEach(function(div) {
  div.addEventListener("click", function() {
    this.classList.toggle("rectangle-expanded"); // Toggle the "expanded" class on click

    // Check if the div has been expanded
    if (this.classList.contains("rectangle-expanded")) {
      // Modify the content inside the div when expanded
      if (this.id === "DGE") {
        this.innerHTML = `\
          <img src="Styling/Dal Games Expo Logo.png" alt="Dal Games Logo" class="image" />
          <div class="content"><p class="ubuntu-regular">The Dal Games Expo is an annual student run event with 600+ attendees last year. I am the main founder and website manager.</p>
          <a class="centered-text" href="https://www.dalgamesexpo.ca" target="_blank" rel="noopener noreferrer">Take a Look</a></div>`;
      } else if (this.id === "GSS") {
        this.innerHTML = `
          <img src="Styling/Clown.png" alt="Clown" class="image" />
          <div class="content"><p class="ubuntu-regular">I made this tool for a streamer, Atrioc, to make it easier to track videos suggested by viewers for his weekly series, Get Smarter Saturday.</p>
          <a class="centered-text" href="Atrioc/GSSTool.html" target="_blank" rel="noopener noreferrer">Take a Look</a></div>`;
      }
    } else {
      // Reset the content when collapsed
      if (this.id === "DGE") {
        this.innerHTML = `<p>Dal Games Expo</p>`;
      } else if (this.id === "GSS") {
        this.innerHTML = `<p>Get Smarter Saturday</p>`;
      }
    }
  });
});
