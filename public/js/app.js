/* CONCITO Group 6 — Figma Sprint 2 implementation.
 * Live dataset and kg CO2e/kg values are served by the unchanged Node backend.
 * The clearly-labelled demo fallback is only used when that dataset is unreachable.
 */
"use strict";

const demoFoods = [
  {id:"demo-dk-carrot",name:"Carrot, raw",country:"DK",category:"Vegetables",total:0.27},
  {id:"demo-dk-avocado",name:"Avocado, raw",country:"DK",category:"Fruits",total:1.217},
  {id:"demo-dk-salami",name:"Sausage, salami",country:"DK",category:"Seafood",total:5.6},
  {id:"demo-dk-squash",name:"Squash, raw",country:"DK",category:"Sweets",total:0.84},
  {id:"demo-es-strawberry",name:"Strawberry, raw",country:"ES",category:"Fruits",total:0.34},
  {id:"demo-dk-bacon",name:"Bacon, frying, raw",country:"DK",category:"Meats",total:6.4},
  {id:"demo-fr-carrot",name:"Carrot, raw",country:"FR",category:"Vegetables",total:0.362}
];
const countryNames = {DK:"Denmark",ES:"Spain",FR:"France",GB:"Great Britain",NL:"Netherlands"};
const countryFlags = {DK:"🇩🇰",ES:"🇪🇸",FR:"🇫🇷",GB:"🇬🇧",NL:"🇳🇱"};
const categoryImages = {
  fruits: "/assets/category-fruits.png",
  seafood: "/assets/category-seafood.png",
  sweets: "/assets/category-sweets.png",
  vegetables: "/assets/category-vegetables-figma.png",
  meats: "/assets/category-meats.png",
  dairy: "/assets/category-dairy.png",
  grains: "/assets/category-grains.png",
  drinks: "/assets/category-drinks.png"
};

let foods = [];
let isDemo = false;
let visibleCount = 7;
let expandedFoodIds = new Set();
let rowCounter = 1;
let recipeRows = Array.from({length:5}, () => blankRow());
let lastResult = [];
let currentlyLoading = false;

const el = {
  root: document.querySelector("#site-root"),
  search: document.querySelector("#search"),
  country: document.querySelector("#country"),
  category: document.querySelector("#category"),
  results: document.querySelector("#results"),
  more: document.querySelector("#more-results"),
  error: document.querySelector("#error"),
  status: document.querySelector("#source-status"),
  sourceMeta: document.querySelector("#source-meta"),
  refresh: document.querySelector("#refresh"),
  rows: document.querySelector("#calculator-rows"),
  calculatorError: document.querySelector("#calculator-error"),
  form: document.querySelector("#meal-form"),
  scoreTotal: document.querySelector("#score-total-number"),
  scoreIngredients: document.querySelector("#score-ingredients")
};

function blankRow() { return {key: rowCounter++,foodId:"",name:"",amount:"",unit:"kg"}; }
function normalize(input) { return String(input??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().trim(); }
function safeText(input) { return String(input??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"); }
function numberText(n,places=3) { return Number(n).toFixed(places).replace(/\.?0+$/, ""); }
function co2(n) { return Number(n).toFixed(3); }
function grade(total) { return total < 1 ? "green" : total <= 3 ? "yellow" : "red"; }
function getFood(id) { return foods.find(f=>String(f.id) === String(id)); }
function searchFoods(query) {
  const q=normalize(query);
  return foods.filter(f=>normalize(f.name).includes(q))
    .sort((a,b)=>Number(normalize(b.name).startsWith(q))-Number(normalize(a.name).startsWith(q)) || a.name.localeCompare(b.name));
}
function setEnabled(value) { [el.search,el.category,el.country].forEach(item=>item.disabled=!value); }
function fillCategories() {
  const old=el.category.value;
  const categories=[...new Set(foods.map(f=>f.category).filter(Boolean))].sort();
  el.category.innerHTML='<option value="all">Select Category</option>' + categories.map(x=>`<option value="${safeText(x)}">${safeText(x)}</option>`).join("");
  el.category.value=categories.includes(old)?old:"all";
}
function filteredFoods() {
  const q=normalize(el.search.value);
  const country=el.country.value;
  const category=el.category.value;
  const list=foods.filter(f=>(country==="all"||f.country===country)&& (category==="all"||f.category===category) && (!q||normalize(f.name).includes(q)));
  if(q) list.sort((a,b)=> Number(normalize(b.name).startsWith(q))-Number(normalize(a.name).startsWith(q)) || a.name.localeCompare(b.name));
  return list;
}
function categoryAsset(category = "", name = "") {
  const c = normalize(category);
  const n = normalize(name);
  const has = (source, ...words) => words.some(word => source.includes(word));

  if (has(c, "confectionery", "sugar sweetening", "sweets", "sweeteners", "dessert", "desserts", "candy", "cocoa")) return categoryImages.sweets;
  if (has(c, "seafood", "fish", "shellfish", "mollusc", "molluscs", "crustacean", "crustaceans")) return categoryImages.seafood;
  if (has(c, "fruit", "fruits", "berries", "berry")) return categoryImages.fruits;
  if (has(c, "vegetable", "vegetables", "legume", "legumes", "potato", "potatoes", "roots", "root crops")) return categoryImages.vegetables;
  if (has(c, "meat", "meats", "poultry")) return categoryImages.meats;
  if (has(c, "dairy", "eggs")) return categoryImages.dairy;
  if (has(c, "bread", "grain", "grains", "cereal", "cereals", "rice", "pasta", "bakery")) return categoryImages.grains;
  if (has(c, "drink", "drinks", "beverage", "beverages", "coffee", "tea", "alcohol")) return categoryImages.drinks;

  if (has(n, "salmon", "tuna", "cod", "shrimp", "prawn", "mussel")) return categoryImages.seafood;
  if (has(n, "apple", "banana", "orange", "grape", "berry", "berries", "melon", "pear")) return categoryImages.fruits;
  if (has(n, "carrot", "broccoli", "tomato", "lettuce", "cabbage", "onion", "pepper", "potato")) return categoryImages.vegetables;
  if (has(n, "beef", "pork", "lamb", "bacon", "ham", "sausage", "chicken", "turkey")) return categoryImages.meats;
  if (has(n, "milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "egg")) return categoryImages.dairy;
  if (has(n, "bread", "rice", "pasta", "flour", "oat", "wheat")) return categoryImages.grains;
  if (has(n, "juice", "coffee", "tea", "wine", "beer", "water")) return categoryImages.drinks;
  if (has(n, "sweet", "sugar", "candy", "chocolate", "marzipan", "syrup")) return categoryImages.sweets;

  return categoryImages.fruits;
}

function categoryArtwork(category, name) {
  return `<img src="${categoryAsset(category, name)}" alt="" loading="lazy">`;
}
function renderFoods() {
  const all=filteredFoods(), visible=all.slice(0,visibleCount);
  if(!foods.length) {
    el.results.innerHTML='<div class="loading-placeholder">Loading food records…</div>';
    el.more.classList.add("hidden");return;
  }
  if(!visible.length) {
    el.results.innerHTML='<div class="empty-placeholder">No foods match your search. Try another category, country or product name.</div>';
  } else {
    el.results.innerHTML=visible.map(food=>{
      const id=String(food.id), open=expandedFoodIds.has(id);
      const added=recipeRows.some(row=>row.foodId===id);
      const breakdown=["agriculture","iluc","processing","packaging","transport","retail"].filter(key=>Number.isFinite(food[key])).map(key=>`${key[0].toUpperCase()+key.slice(1)}: ${numberText(food[key],3)}`).join(" · ");
      return `<article class="result-card ${open?'expanded':''}" data-food-id="${safeText(id)}">
        <div class="category-cell">${categoryArtwork(food.category, food.name)}<span>${safeText(food.category)}</span></div>
        <div><span class="product-pill">${safeText(food.name)}</span></div>
        <div class="country-cell"><span class="country-flag">${countryFlags[food.country]||"🌍"}</span><span class="country-name">${safeText(countryNames[food.country]||food.country)}</span></div>
        <div><span class="footprint-pill ${grade(food.total)}">${numberText(food.total)} CO2</span></div>
        <button type="button" class="see-more" data-more-id="${safeText(id)}" aria-expanded="${open}">See more <svg aria-hidden="true" width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="m4 6 10 10L24 6"/></svg></button>
        ${open?`<div class="result-details"><div class="breakdown"><strong>${numberText(food.total,3)} kg CO₂e per kg</strong> · ${safeText(countryNames[food.country]||food.country)}${breakdown?`<div>${safeText(breakdown)}</div>`:''}</div><button class="add-food-button" type="button" data-add-id="${safeText(id)}" ${added?'disabled':''}>${added?'Added to meal ✓':'Add to meal +'}</button></div>`:''}
      </article>`;
    }).join("");
  }
  el.more.classList.toggle("hidden",all.length<=visibleCount);
  el.more.textContent=`Show more foods (${Math.min(7,all.length-visibleCount)} of ${all.length-visibleCount} remaining)`;
}
function resetResults() {visibleCount=7; expandedFoodIds.clear();renderFoods();}
function addFoodToMeal(id) {
  const food=getFood(id);if(!food)return;
  if(recipeRows.some(r=>r.foodId===String(id)))return;
  let row=recipeRows.find(r=>!r.foodId&&!r.name.trim());
  if(!row){row=blankRow();recipeRows.push(row);}
  row.foodId=String(food.id);row.name=food.name;
  saveRecipe();renderCalculatorRows();renderFoods();
}
function saveRecipe() {try{localStorage.setItem("concito-team6-recipe-v2",JSON.stringify(recipeRows));}catch{} }
function loadRecipe() {
  try {const data=JSON.parse(localStorage.getItem("concito-team6-recipe-v2")||"null");if(Array.isArray(data)&&data.length&&data.length<=60){
    recipeRows=data.map(x=>({key:rowCounter++,foodId:String(x.foodId||""),name:String(x.name||""),amount:String(x.amount||""),unit:x.unit==="g"?"g":"kg"}));
    while(recipeRows.length<5)recipeRows.push(blankRow());
  }}catch{}
}
function selectedSuggestions(term) {
  const q=normalize(term);
  if(q.length<2)return [];
  return searchFoods(term).slice(0,7);
}
function showSuggestions(row, input) {
  document.querySelectorAll(".suggestion-list").forEach(list=>list.remove());
  const matches=selectedSuggestions(input.value);
  if(!matches.length)return;
  const wrap=input.closest(".ingredient-cell");
  const menu=document.createElement("div");menu.className="suggestion-list";menu.setAttribute("role","listbox");
  menu.innerHTML=matches.map(f=>`<button type="button" role="option" data-suggestion-id="${safeText(f.id)}" data-row-key="${row.key}">${safeText(f.name)}<small>${safeText(countryNames[f.country]||f.country)} · ${numberText(f.total)} kg CO₂e/kg</small></button>`).join("");
  wrap.appendChild(menu);
}
function renderCalculatorRows() {
  el.rows.innerHTML=recipeRows.map(row=>`<div class="ingredient-row" data-row-key="${row.key}">
    <div class="ingredient-cell">
      <input class="ingredient-input" type="text" autocomplete="off" spellcheck="false" aria-label="Ingredient" placeholder="Ingredient..." data-ingredient-key="${row.key}" value="${safeText(row.name)}">
    </div>
    <div class="amount-box">
      <input class="amount-input" type="number" min="0" step="any" inputmode="decimal" aria-label="Ingredient quantity" placeholder="Amount....." data-amount-key="${row.key}" value="${safeText(row.amount)}">
      <select class="unit-select" data-unit-key="${row.key}" aria-label="Unit"><option value="kg" ${row.unit==='kg'?'selected':''}>Kg</option><option value="g" ${row.unit==='g'?'selected':''}>g</option></select>
    </div>
    <button type="button" class="delete-row" data-delete-key="${row.key}" aria-label="Remove ingredient row" title="Delete row">
      <svg aria-hidden="true" viewBox="0 0 28 30" fill="currentColor"><path d="M10 2h8l1.5 3H26v4H2V5h6.5L10 2ZM5 11h18l-1.1 15.2c-.1 1.5-1.4 2.8-3 2.8h-9.8c-1.6 0-2.9-1.3-3-2.8L5 11Zm5 4v10h2V15h-2Zm6 0v10h2V15h-2Z"/></svg>
    </button>
  </div>`).join("");
  updateMealScene();
}
function updateMealScene() {
  const counter = document.querySelector("#meal-visual-count");
  const progress = document.querySelector("#meal-visual-progress");
  if (!counter || !progress) return;
  const count = recipeRows.filter(row => row.foodId && getFood(row.foodId)).length;
  counter.textContent = String(count);
  progress.style.width = `${Math.min(100, count / 5 * 100)}%`;
}
function selectedRow(key) {return recipeRows.find(row=>row.key===Number(key));}
function selectFoodForRow(key,id) {
  const row=selectedRow(key), food=getFood(id);
  if(!row||!food)return;
  row.foodId=String(food.id);row.name=food.name;
  saveRecipe();renderCalculatorRows();
  const dom=el.rows.querySelector(`[data-row-key="${row.key}"] .amount-input`);
  dom?.focus();
}
function calculateRows() {
  let hasError=false;
  let firstInvalid=null;
  const nonempty=recipeRows.filter(row=>row.name.trim()||row.amount.trim()||row.foodId);
  if(!nonempty.length) {
    el.calculatorError.textContent="Please add at least one ingredient before calculating.";
    return false;
  }
  lastResult=[];
  el.rows.querySelectorAll(".invalid").forEach(e=>e.classList.remove("invalid"));
  for(const row of nonempty){
    const field=el.rows.querySelector(`[data-row-key="${row.key}"]`);
    const food=getFood(row.foodId);
    const raw=String(row.amount).trim();
    const amount=Number(raw);
    const invalidFood=!food||normalize(food.name)!==normalize(row.name);
    const invalidAmount=!raw||!Number.isFinite(amount)||amount<=0;
    if(invalidFood||invalidAmount){
      hasError=true;
      if(invalidFood)field?.querySelector(".ingredient-input")?.classList.add("invalid");
      if(invalidAmount)field?.querySelector(".amount-box")?.classList.add("invalid");
      firstInvalid ||= invalidFood?"Choose a valid ingredient from the suggestions.":"Enter an amount greater than zero for each ingredient.";
      continue;
    }
    const grams=row.unit==="g"?amount:amount*1000;
    const emissions=grams/1000*Number(food.total);
    lastResult.push({id:food.id,name:food.name,amount,unit:row.unit,grams,emissions});
  }
  if(hasError){el.calculatorError.textContent=firstInvalid;return false;}
  el.calculatorError.textContent="";
  saveRecipe();renderScore();return true;
}
function renderScore() {
  const total=lastResult.reduce((sum,r)=>sum+r.emissions,0);
  el.scoreTotal.textContent=Number(total).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3});
  el.scoreIngredients.innerHTML=lastResult.length?lastResult.map(r=>`<div class="score-ingredient-row">
    <span class="score-ingredient-name">${safeText(r.name)}</span>
    <span>${safeText(numberText(r.amount,3))}${r.unit}</span>
    <span class="score-result-pill"><span>${co2(r.emissions)}</span><span>CO₂</span></span>
  </div>`).join(""):'<div class="empty-placeholder">No ingredients calculated yet.</div>';
}
function route() {
  let view=location.hash.replace(/^#/,"").trim().toLowerCase();
  if(!["home","calculator","results","about"].includes(view))view="home";
  if(view==="results"&&!lastResult.length)view="calculator";
  el.root.dataset.view=view;
  document.querySelectorAll("main > .page").forEach(section=>section.classList.add("hidden"));
  document.querySelector(`#${view==='home'?'home':view==='results'?'results':view}-view`)?.classList.remove("hidden");
  document.title=({home:"The Big Climate Database",calculator:"Calculate your meal",results:"The score",about:"About the database"})[view]+" | CONCITO";
  window.scrollTo({top:0,behavior:"instant"});
}
async function loadData(refresh=false) {
  if(currentlyLoading)return;
  currentlyLoading=true;
  setEnabled(false);
  el.status.textContent=refresh?"Refreshing the official database…":"Loading the official database…";
  el.sourceMeta.textContent="";
  el.error.classList.add("hidden");
  try{
    const response=await fetch(`/api/foods${refresh?'?refresh=1':''}`,{cache:"no-store"});
    const json=await response.json();
    if(!response.ok||!Array.isArray(json.foods)||!json.foods.length)throw new Error(json.detail||json.error||"Empty database response");
    foods=json.foods;
    isDemo=false;
    const cached=String(json.mode||"").includes("cache")||json.mode==="memory";
    el.status.textContent=cached?"Official data · local cache":"Official data · live";
    el.sourceMeta.textContent=`${json.count} records · kg CO₂e/kg`;
  }catch(e){
    foods=demoFoods.map(x=>({...x}));
    isDemo=true;
    el.status.textContent="Figma example data · demo mode";
    el.sourceMeta.textContent="Examples only · not official figures";
    el.error.textContent="The official database could not be loaded. Showing 7 visual examples from the Figma mockup. Calculations using these examples are for demonstration only.";
    el.error.classList.remove("hidden");
  }finally{
    currentlyLoading=false;
    fillCategories();
    setEnabled(true);
    resetResults();
    renderCalculatorRows();
  }
}

el.search.addEventListener("input",resetResults);
el.country.addEventListener("change",resetResults);
el.category.addEventListener("change",resetResults);
el.refresh.addEventListener("click",()=>loadData(true));
el.more.addEventListener("click",()=>{visibleCount+=7;renderFoods();});
el.results.addEventListener("click",event=>{
  const more=event.target.closest("[data-more-id]");
  if(more){const id=more.dataset.moreId;expandedFoodIds.has(id)?expandedFoodIds.delete(id):expandedFoodIds.add(id);renderFoods();return;}
  const add=event.target.closest("[data-add-id]");
  if(add)addFoodToMeal(add.dataset.addId);
});
el.rows.addEventListener("input",event=>{
  const node=event.target;
  if(node.matches("[data-ingredient-key]")){
    const row=selectedRow(node.dataset.ingredientKey);if(!row)return;
    row.name=node.value;
    if(!getFood(row.foodId)||normalize(getFood(row.foodId).name)!==normalize(row.name))row.foodId="";
    node.classList.remove("invalid");
    showSuggestions(row,node);
  }else if(node.matches("[data-amount-key]")){
    const row=selectedRow(node.dataset.amountKey);if(!row)return;
    row.amount=node.value;
    node.closest(".amount-box")?.classList.remove("invalid");
  }
  el.calculatorError.textContent="";
  saveRecipe();
});
el.rows.addEventListener("change",event=>{
  const node=event.target;
  if(node.matches("[data-unit-key]")){
    const row=selectedRow(node.dataset.unitKey);
    if(row){row.unit=node.value;saveRecipe();}
  }
});
el.rows.addEventListener("click",event=>{
  const suggestion=event.target.closest("[data-suggestion-id]");
  if(suggestion){selectFoodForRow(suggestion.dataset.rowKey,suggestion.dataset.suggestionId);return;}
  const del=event.target.closest("[data-delete-key]");
  if(del){recipeRows=recipeRows.filter(row=>row.key!==Number(del.dataset.deleteKey));while(recipeRows.length<5)recipeRows.push(blankRow());saveRecipe();renderCalculatorRows();renderFoods();}
});
el.rows.addEventListener("keydown",event=>{
  if(event.target.matches("[data-ingredient-key]")&&event.key==="Enter"){
    const first=event.target.closest(".ingredient-cell")?.querySelector("[data-suggestion-id]");
    if(first){event.preventDefault();selectFoodForRow(first.dataset.rowKey,first.dataset.suggestionId);}
  }
});
document.addEventListener("click",event=>{
  if(!event.target.closest(".ingredient-cell"))document.querySelectorAll(".suggestion-list").forEach(list=>list.remove());
});
document.querySelector("#add-row").addEventListener("click",()=>{
  recipeRows.push(blankRow());renderCalculatorRows();saveRecipe();
  el.rows.lastElementChild?.querySelector(".ingredient-input")?.focus();
});
el.form.addEventListener("submit",event=>{
  event.preventDefault();
  if(calculateRows())location.hash="#results";
});
window.addEventListener("hashchange",route);
loadRecipe();renderCalculatorRows();renderScore();route();loadData();
