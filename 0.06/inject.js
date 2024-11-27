$(window).on('ExtLoad', function (e) {
    addExtTab("Node List","NodeListExtension").append( '<script src="'+$('#AppDNodeListExtensionContentScript').data('datatablelink')+'"></script>'+
        '<script src="'+$('#AppDNodeListExtensionContentScript').data('filesaverlink')+'"></script>'+
        '<link rel="stylesheet" type="text/css" href="'+$('#AppDNodeListExtensionContentScript').data('csslink')+'" media="screen" />'+
        '<div id="progress" style="padding:10px 0px 10px 0px" ></div>'+
        '<div class="table-style-two-container"></div>'+
        '<table id="NodeList"></table>'+
        '<div id=download>Download</div>'+
        '</div>')


    if(count==0) go()
    else draw()
});

var count=0;
var newData = []
var dataobj = {}
var nodes = {};
var tiers = {};
var applications = {};
var sec="";
var agenttypes = {
    PYTHON_APP_AGENT: {name: "Python", img: '<img src="images/tierTypes/python.svg">', machinenames: {}, licenses: 0},
    APP_AGENT: { name: "Java", img: '<img src="images/tierTypes/Java.svg">', machinenames: {}, licenses: 0},
    NATIVE_SDK:  { name: "C++", img: '<img src="images/tierTypes/c++.svg" onerror="if (this.src != \'images/tierTypes/c++.svg\') this.src = \'images/tierTypes/native.svg\'">', machinenames: {}, licenses: 0},
    PHP_APP_AGENT: {name: "Php", img: '<img src="images/tierTypes/php.svg">', machinenames: {}, licenses: 0},
    NODEJS_APP_AGENT: {name: "Nodejs", img:'<img src="images/tierTypes/node_js.svg">', machinenames: {}, licenses: 0},
    DOT_NET_APP_AGENT: {name: ".Net", img: '<img src="images/tierTypes/dot_net.svg">', machinenames: {}, licenses: 0},
    NATIVE_WEB_SERVER: {name: "Apache", img: '<img src="images/tierTypes/WebServers.svg">', machinenames: {}, licenses: 0},
    MACHINE_AGENT: {name: "Machine", img: '<img src="">', machinenames: {}, licenses: 0},
    GOLANG_SDK: {name: "Go", img: '<img src="images/tierTypes/Golang.svg">', machinenames: {}, licenses: 0}
}

function go() {
    function GetX(){
        var cs = document.cookie.split(';');
        var jcs = {}
        for ( var i=0; i< cs.length; i++ ) {
            var c = cs[i].trim().split('=');
            jcs[c[0]] = c[1];
        }
        return jcs['X-CSRF-TOKEN']
    }

    
    $('#progress').text("Calling");
    var url = window.location.href
    var arr = url.split("/");
    var domain = arr[0] + "//" + arr[2]
    $.ajax({
        url: domain+"/controller/rest/applications?output=json",
        headers: { "X-CSRF-Token": GetX() },
        error: function() {
            $('#progress').text("initial call failed");
        },
        success: function(data) {
            var i;
            var deferreds = [];
            for ( i=0; i < data.length; i++ ) {
                applications[data[i].id]=data[i].name
                //console.log("inloop"+i)
                var name = data[i].name
                deferreds.push($.ajax({
                    url: domain + "/controller/rest/applications/"+data[i].id+"/nodes?output=json",
                    ind: i,
                    headers: { "X-CSRF-Token": GetX() },
                    success: function(data2) {
                        //console.log(data2,"return2: "+name)
                        for(var j=0; j<data2.length; j++)
                        {
                            nodes[data2[j].id]={
                                Nodename: data2[j].name,
                                tierid: data2[j].tierId, 
                                appid: data[this.ind].id, 
                                agentType: data2[j].agentType, 
                                agentversion: data2[j].appAgentVersion,
                                machineName: data2[j].machineName
                            }
                            //console.log(nodes[data2[j].id])
                        }
                        $('#progress').text("Processed " + ++count + " out of " + data.length*2 + " Application calls");
                    }
                }));
                deferreds.push($.ajax({
                    url: domain+"/controller/rest/applications/"+data[i].id+"/tiers?output=json",
                    headers: { "X-CSRF-Token": GetX() },
                    success: function(data2) {
                        //console.log(data2,"return2: "+name)
                        for(var j=0; j<data2.length; j++)
                        {
                            tiers[data2[j].id]=data2[j].name
                        }
                        $('#progress').text("Processed " + ++count + " out of " + data.length*2 + " Application calls");
                    }
                }));

            }
            $.when.apply($,deferreds).done(function(){

                //console.log(nodes,applications);
                
                var postarr = [];
                for ( var key in nodes ) {
                    nodes[key].tiername = tiers[nodes[key].tierid];
                    nodes[key].appname = applications[nodes[key].appid];
                    nodes[key].AppPCAvail = 0;
                    nodes[key].MachPCAvail = 0;
                    postarr.push(key);
                }

                //console.log(JSON.stringify(postarr));
                var url= domain+"/controller/restui/appInfra/healthStatsForNodes?time-range=last_5_minutes.BEFORE_NOW.-1.-1.5"; 
                console.log(url);
                $.ajax({
                    url: url,
                    type: "POST",
                    data: JSON.stringify(postarr),
                    headers: {"Content-Type": "application/json;charset=UTF-8",
                              "X-CSRF-Token": GetX() },
                    dataType: "json",
                    success: function(fastdata) {
                        //console.log(fastdata);
                        for (var i=0; i < fastdata.length; i++)
                        {
                            var nodeid = fastdata[i].appServerAgentAvailability.entityId
                            nodes[nodeid].AppPCAvail = fastdata[i].appServerAgentAvailability.percentage;  
                            nodes[nodeid].MachPCAvail = fastdata[i].machineAgentAvailability.percentage;  
                        }

                        //console.log(nodes);

                        for ( var key in nodes ) {
                            dataobj[nodes[key].machineName] = {machineName: nodes[key].machineName, agentversion: "", consumesdotNetLicense: 0}
                        }
                        
                        var avail = 0
                        var mavail = 0
                        var availimg = ""
                        var mavailimg = ""
                        var agentversion = ""
                            
                        for ( var key in nodes ) {
                            avail = 0
                            mavail = 0
                            availimg = mavailimg = '<center><img src="images/health/warning.svg"></center>'

                            if (nodes[key].agentversion != "") dataobj[nodes[key].machineName].agentversion = nodes[key].agentversion
                            agentversion = nodes[key].agentversion.split(' GA')
                            agentversion = agentversion[0].split("v")
                            agentversion = agentversion[agentversion.length-1]


                            if (nodes[key].MachPCAvail > 0 ){
                                mavail = 1;
                                mavailimg = '<center><img src="images/health/normal.svg"></center>'
                            }

                            if (nodes[key].AppPCAvail > 0) {
                                dataobj[nodes[key].machineName].consumesdotNetLicense = 1;
                                avail = 1;
                                availimg = '<center><img src="images/health/normal.svg"></center>'
                                agenttypes[nodes[key].agentType].machinenames[nodes[key].machineName] = true
                                if (nodes[key].agentType=="APP_AGENT") agenttypes[nodes[key].agentType].licenses++
                                if (nodes[key].agentType=="NODEJS_APP_AGENT") agenttypes[nodes[key].agentType].licenses += 0.1
                            }
                            
                            newData.push({
                                id: nodes[key],
                                application: "<a href='#/location=APP_DASHBOARD&application="+
                                    nodes[key].appid+"' target='_blank'>"+
                                    nodes[key].appname+"</a>", 
                                tier: "<a href='#/location=APP_COMPONENT_MANAGER&application="+
                                    nodes[key].appid+"&component="+
                                    nodes[key].tierid+"' target='_blank'>" +
                                    nodes[key].tiername+"</a>",
                                node: "<a href='#/location=APP_NODE_MANAGER&application="+
                                    nodes[key].appid+"&node="+
                                    key+"' target='_blank'>"+
                                    nodes[key].Nodename+"</a>",
                                available: availimg,
                                maavailable: mavailimg,
                                type: agenttypes[nodes[key].agentType].img+agenttypes[nodes[key].agentType].name+"</img>",
                                version: agentversion,
                                machine: nodes[key].machineName
                            });
                        }

                        //console.log(newData);
                        


                        for (var atkey in agenttypes)
                        {
                            if (atkey != "APP_AGENT" && atkey != "NODEJS_APP_AGENT") agenttypes[atkey].licenses = Object.keys(agenttypes[atkey].machinenames).length
                            if (atkey == "NATIVE_SDK" ) agenttypes[atkey].licenses /= 3
                        }

                        draw()
                        /*var str = ConvertToCSV(dataobj);
                        str += '\r\n';
                        str += ConvertToCSV(nodes);
                        //console.log(str);
                        var blob = new Blob([str], {type: "text/csv"});
                        saveAs(blob, ""+domain+".csv");*/

                    }
                })
                // end of health status calls    
                
                
            });
        }
    });
}

function draw(){
    console.log(newData)
 

    var data = {
		"headings": [
                'Type',
                'Application',
                'Tier',
                'Node',
                'Version',
                'Available',
                'MAAvailable',
                'Machine',
		],
		"data": []
		/*	[
				"Hedwig F. Nguyen",
				"Arcu Vel Foundation",
				"9875",
				"03/27/2017",
				"nunc.ullamcorper@metusvitae.com",
				"070 8206 9605",
				"070 8206 9605",
				"070 8206 9605"
			],
			[
				"Genevieve U. Watts",
				"Eget Incorporated",
				"9557",
				"07/18/2017",
				"Nullam.vitae@egestas.edu",
				"Nullam.vitae@egestas.edu",
				"Nullam.vitae@egestas.edu",
				"0800 025698"
			],
						 ]*/
	};
	for (row in newData) {
	  var arr=[]
	  for (heading in data.headings) {
            arr.push(newData[row][data.headings[heading].toLowerCase()])
	  }
	  data.data.push(arr)
	}
	
	
	var log = [];
	var t = $('#healthtable')[0]
    var dt = new DataTable(t, { data: data });




    /*$('#errors').dynatable({
        dataset: {
                     records: newData
                 }
    });

    $('#errors').show();
    $('#progress').hide();

    $('#errors').on( 'dynatable:afterProcess', function () {
        console.log($('#errors').data('dynatable').records.getFromTable()); 
    });

    for (var atkey in agenttypes)
    {
        if (agenttypes[atkey].licenses != 0)
            $('#license tbody tr').append("<td style='padding:5px'>"+agenttypes[atkey].img+agenttypes[atkey].name+":</img></td><td>"+agenttypes[atkey].licenses+"</td>")
    }*/

    $('#download').on('click', function(){
        var str = ConvertToCSV(nodes);
        var blob = new Blob([str], {type: "text/csv"});
        saveAs(blob, "AgentList.csv");
        //var uriContent = "data:application/octet-stream," + encodeURIComponent(ConvertToCSV(nodes));
        //window.open(uriContent, 'AgentList.csv');
    })
}

function ConvertToCSV(oa) {
    var str = '';

    var firstline = true
    var topline = ''
    for ( var key in oa ) {
        var line = ''
        for ( var key2 in oa[key] ) {
            if(firstline) {
                if (topline != '') topline += ',';
                topline += key2;
            }
            if (line != '') line += ',';
            line += oa[key][key2];
        }
        if(topline != '' && firstline) {
            str += topline + '\r\n';
            firstline = false;
        }
        str += line + '\r\n';
    }

    return str;
}
