function toggleSearchParameters() {
  const searchParameters = document.getElementById("searchParameters");
  if (searchParameters.style.display === "none") {
    searchParameters.style.display = "block";
  } else {
    searchParameters.style.display = "none";
  }
}

document.getElementById("searchSettings").addEventListener("click", toggleSearchParameters);


