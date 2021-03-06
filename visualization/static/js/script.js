//Variables
var depUniqueId = 0;
var dependancies = {};
var graph;
var clickedNode;

//JQuery Event handlers
$("#submit_address").submit(function(e){
  var addrCurious = $("#inputAddress").val();
  console.log(addrCurious);
  d3.json("get_neighbour_wallet?wallet="+addrCurious, function(error, json){
    if (error) throw error;
    graph = json;

    dependancies = {};
    depUniqueId=0;
    calculateDependencies(graph, "node0");
    render();

  });
  e.preventDefault();
});

function detectEntity(d){
    d3.json("get_entity?root="+d.address, function(error, ans){
      for(var nodeId in graph.nodes){
        var node = graph.nodes[nodeId];
        node.group = node.group === 5 ? node.oldGroup : node.group;
        if (node.address && ans.includes(node.address)){
          node.oldGroup=node.group;
          node.group=5;
          console.log(node.address);
        }
      }
      console.log(ans)
      render();
    });
}

// Modifies Graph so that each node is dependant on dependantOn
function calculateDependencies(graph, dependantOn){
  for (var i = 0;i<graph.nodes.length;i++){
    var node = graph.nodes[i];
    node["dependencyId"] = "node"+depUniqueId;
    dependancies["node"+depUniqueId] = []
      if (depUniqueId !== 0){
        dependancies[dependantOn].push("node"+depUniqueId)
      }
    depUniqueId++;
  }
  for (var i=0;i<graph.links.length;i++){
    var link = graph.links[i];
    link["dependencyId"] = "link"+depUniqueId;
    dependancies["link"+depUniqueId] = []
      dependancies[dependantOn].push("link"+depUniqueId)
      depUniqueId++;
  }
}

//Handle adding nodes
function expandNode(d){

  depId = d["dependencyId"];

  //If the node clicked is a leaf, then expand it 
  if (dependancies[depId].length === 0){
    d3.json("get_neighbour_wallet?wallet="+d.address, function(error, json){
      mergeGraph(json, d["dependencyId"]);
    });
  } else {
    // If the node clicked is an internal node, then remove all nodes that it 
    // opened
    // Algorithm: Figure out which nodes/edges to remove using a DFS strategy 
    // from current node, then, create a new graph with the nodes/edges not deleted
    var thingsToRemove = new Set();
    var queue = dependancies[depId].slice(0);
    dependancies[depId] = [];
    while(queue.length > 0){
      var item = queue.pop();
      thingsToRemove.add(item);
      queue = queue.concat(dependancies[item]);
      delete dependancies[item];
    }

    // Construct the new graph
    var newGraph = {links: [], nodes: []}
    for(var i = 0;i<graph.nodes.length;i++){
      if (!thingsToRemove.has(graph.nodes[i]["dependencyId"])){
        newGraph.nodes.push(graph.nodes[i]);
      }
    }
    for(var i = 0;i<graph.links.length;i++){
      if (!thingsToRemove.has(graph.links[i]["dependencyId"])){
        newGraph.links.push(graph.links[i]);
      }
    }
    graph = newGraph;
    render();
  }
}

//Merges newGraph into graph, and, all items in newGraph are dependant on 
//branchFromId
function mergeGraph(newGraph, branchFromId){
  var nodeSet = new Set();
  graph.nodes.forEach(function(item){nodeSet.add(item['id'])}); 
  newGraph.nodes = newGraph.nodes.filter( function(node){
    return !nodeSet.has(node['id'])
  });

  var linkSet = new Set();
  graph.links.forEach(function(item){
    linkSet.add(item['source']+"-"+item['target'])
  }); 
  newGraph.links = newGraph.links.filter(function(link){
    return !linkSet.has(link['source']+"-"+link['target']);
  });
  calculateDependencies(newGraph,branchFromId);

  graph.nodes = graph.nodes.concat(newGraph.nodes);
  graph.links = graph.links.concat(newGraph.links);

  render();
}

//Helper function to update info at the bottom of the graph
function updateHoverInfo(info){
  unhoverItem();
  var $info = $("#hover-info");
  var $template = $("#hover-pair-template");
  Object.keys(info).forEach(function(attribute){
    var $clone = $template.clone();
    $clone.attr("id", "").attr("class", "hover-pair");
    $clone.find(".hover-key").text(attribute)
      $clone.find(".hover-value").text(info[attribute]);
    $clone.appendTo($info);
  });
}

//Handling hover nodes
function hoverNode(d){
  var attrShow = ["type", "address","hash"];
  var info = {};
  attrShow.forEach(function(attribute, idx, arr){
    if(d[attribute]){
      info[attribute] = d[attribute];
    }
    if(idx === arr.length -1){
      updateHoverInfo(info);
    }
  });
}

//Handling hover Edges
function hoverEdge(d){
  unhoverItem();
  var info = {};
  info["Transaction Value"] = d["value"];
  var src = d["source"];
  info["From"] = (src.type === "transaction") ? src["hash"] : src["address"];
  var dest = d["target"];
  info["To"] = (dest.type === "transaction") ? dest["hash"] : dest["address"];

  updateHoverInfo(info);
}

function unhoverItem(){
  var $info = $("#hover-info");
  $info.find(".hover-pair").remove()
}

//Handle Node Clicks 
function sendToClipboard(string){

  function cloneTemplate(template) {
    return template.clone().attr("id", "").removeClass("template").removeClass("hidden").addClass("cloned");
  }

  //Send string to clipboard
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val(string).select();
  document.execCommand("copy");
  $temp.remove();

  //Show alert
  var newTemplate = cloneTemplate($("#alert-template"));
  newTemplate.find("p").text("Copied '" + string + "' to clipboard");
  $("#alerts-section").append(newTemplate);
}


// D3 graph generation
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

var node = svg.selectAll(".node");
var link = svg.selectAll(".link");


var color = d3.scaleOrdinal(d3.schemeCategory20);

var simulation = d3.forceSimulation()
  .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(function(d){ return 150;}))
  .force("charge", d3.forceManyBody())
  .force("center", d3.forceCenter(width / 2, height / 2))
  .on("tick", ticked);

  // build the arrow end.
  svg.append("svg:defs").selectAll("marker")
  .data(["end"])      // Different link/path types can be defined here
  .enter().append("svg:marker")    // This section adds in the arrows
  .attr("id", String)
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 15)
  .attr("refY", -1.5)
  .attr("markerWidth", 6)
  .attr("markerHeight", 6)
  .attr("orient", "auto")
  .append("svg:path")
  .attr("d", "M0,-5L10,0L0,5");





  //D3 render
  function render() {

    link = svg.selectAll(".link")
      .data(graph.links)

      link.exit().remove();

    link.enter().append("path")
      .attr("class", "link")
      .attr("stroke-width", function(d) { return (Math.log(Math.log(d.value))); })
      .attr("marker-end", "url(#end)")
      .on('mouseover', hoverEdge)
      .on('mouseout', unhoverItem);


    node = svg.selectAll(".node")
      .data(graph.nodes);

    node.select("circle")
      .attr("fill", function(d) { return d.group === 5 ? "#000" : color(d.group) });

    node.exit().remove();

    newNodes = node
      .enter().append("svg:g")
      .attr("class", "node")
      .call(d3.drag().on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));
    newNodes
      .append("circle")
      .attr("r", 10)
      .attr("fill", function(d) { return color(d.group); });
    newNodes
      .append("text")
      .attr("dx", 12)
      .text(function(d) { return (d.type === "wallet" ? d.address.substring(0,7) : d.hash.substring(0, 7)) + "..."; });
    newNodes
      .append("title")
      .text(function(d) { return d.type === "wallet" ? d.address : d.hash; });
    newNodes
      .on('dblclick', function(d, i){
        if(d.type === "wallet"){
          let  id = d.address;
          //some ajax call
          expandNode(d);
        }
      });
    newNodes
      .on('mouseover', hoverNode)
      .on('mouseout', unhoverItem);

    newNodes.on('contextmenu', function(d){
      d3.event.preventDefault();
      clickedNode = d;

      div.style("opacity", 0.9);
      div.html($(".context-menu").html()+"<br/>")                               
           .style("left", (d3.event.pageX) + "px")                                 
           .style("top", (d3.event.pageY - 28) + "px");     
    });

    node = svg.selectAll(".node");
    link = svg.selectAll(".link");

    simulation.nodes(graph.nodes);
    simulation.force("link").links(graph.links);
    simulation.restart();

  }//End Render function


//D3 visualization manipulation helpers 
function ticked() {
  link.attr("d", function(d) {
    var dx = d.target.x - d.source.x,
    dy = d.target.y - d.source.y,
    dr = Math.sqrt(dx * dx + dy * dy);
    return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
  });
  node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

var div = d3.select("body").append("div")                                       
   .attr("class", "tooltip")                                                       
   .style("opacity", 0); 

d3.select("body")
        .on("click", function(){
          d3.select(".tooltip").style("opacity", "0");
        });

