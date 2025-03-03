window.backgroundGenerator(true);
// Select all elements with the class 'expandable'
const expandableDivs = document.querySelectorAll(".rectangle");

// Loop through each element and attach the click event listener
expandableDivs.forEach(function(div) {
  div.addEventListener("click", function() {
    this.classList.toggle("rectangle-expanded"); // Toggle the "expanded" class on click

    // Check if the div has been expanded
    if (this.classList.contains("rectangle-expanded")) {
      // Modify the content inside the div when expanded
      let content = "";
      if (this.id === "PR") {
        content = `
          <img src="Styling/PenguinRacing.png" alt="Penguin Racing Logo" class="image" />
          <div class="content"><p class="ubuntu-regular">Penguin Racing is a game I made as a sort of Game Jam challenge to make a game in under a week while learning/using Love2D, a 2D game making framework for Lua. It was fun, I learned a lot, and is a learning tactic I will use more often.</p>
          <div class="linkAndGit"><a href="https://github.com/nandrychuk/PenguinRacing" target="_blank" rel="noopener noreferrer"><img class="smallLogo" src="../Styling/github-mark.svg"></a></div></div>`;
      } else if (this.id === "CI") {
        content = `
        <img src="Styling/csv.png" alt="Custom CSV icon" class="image" />
        <div class="content"><p class="ubuntu-regular">These are some custom icons I have slowly added onto just to make my list a little prettier using files that either the icons didn't load properly, I don't like, or that were very generic. CSV is rainbow because of my colour coded VSC extension for CSVs</p>
        <div class="linkAndGit"><a href="https://github.com/nandrychuk/CustomIcons" target="_blank" rel="noopener noreferrer"><img class="smallLogo" src="../Styling/github-mark.svg"></a></div></div>`;
      } else if (this.id === "MD") {
        content = `
        <img src="Styling/MinecraftGrassBlock.png" alt="Minecraft Grass Block" class="image" />
        <div class="content"><p class="ubuntu-regular">Minecraft is a game I have probably spent over 10k hours in. Most of the tools I needed to enhance my experience like mods and datapacks have been made by other people, however I have made a few myself when I couldn't find them, this here is my favourite, because it simply saves me time.</p>
        <div class="linkAndGit"><a href="https://www.planetminecraft.com/data-pack/tnt-beacon/" target="_blank" rel="noopener noreferrer"><img class="smallLogo" src="Styling/PlanetMinecraftLogo.svg"></a></div></div>`;
      }
      this.innerHTML = content;

    } else {
      // Reset the content when collapsed
      if (this.id === "PR") {
        this.innerHTML = `<p class="ubuntu-medium">Penguin Racing</p>`;
      } else if (this.id === "CI") {
        this.innerHTML = `<p class="ubuntu-medium">Custom Icons</p>`;
      } else if (this.id === "MD") {
        this.innerHTML = `<p class="ubuntu-medium">Minecraft Datapacks</p>`;
      }
    }
  });
});