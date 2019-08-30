/*global location */
sap.ui.define([
	"com/blueboot/createorder/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"com/blueboot/createorder/utils/formatter",
	"sap/m/BusyDialog",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"com/blueboot/createorder/config/config"
], function (BaseController, JSONModel, MessageBox, formatter, BusyDialog, Filter, FilterOperator, MessageToast, config) {
	"use strict";

	return BaseController.extend("com.blueboot.createorder.controller.Order", {

		formatter: formatter,
		_funcLocStack: [],
		_equipStack: [],
		_currentFuncLoc: null,
		_oBusyDialog: null,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			sap.ui.require(['com/blueboot/createorder/utils/Scanner']);
			this.getRouter().attachRoutePatternMatched(this.onRouteMatched, this);
			this._oBusyDialog = new BusyDialog();
			this.getView().bindElement("/Order");
			this._oBundle = sap.ui.getCore().getModel("i18n").getResourceBundle();
		},

		onRouteMatched: function (oEvent) {
			if (oEvent.getParameter("name") !== "order") {
				/* Por alguna razon en el "onNavBack" ejecuta esto yendo al home. En la doc tira que haga esto */
				return;
			}
			this.getView().bindElement("/Order");
			var sNotificationId = oEvent.getParameter("arguments").NotificationId,
				oView = this.getView(),
				oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = {};
			oNewOrder.OrderComponentSet = [];
			oNewOrder.OrderOperationSet = [];
			oNewOrder.OrderAddress = {};
			oLocalModel.setProperty("/ParentOperations", []);
			var oFileUploader = oView.byId("photoFileUploader");
			oFileUploader.clear();
			oFileUploader.destroyHeaderParameters();
			// A partir de notificacion
			if (sNotificationId !== "0") {
				var oDataModel = sap.ui.getCore().getModel("oDataModel"),
					that = this,
					dfdEquipments = $.Deferred(),
					dfdFuncLocs = $.Deferred(),
					dfdGroups = $.Deferred();
				this.getView().setBusy(true);
				oDataModel.read("/NotifSet('" + sNotificationId +
					"')?$expand=NotifItemSet,NotifActivitySet,NotifLongtextSet,NotifTaskSet,NotifPhotoSet", {
						success: function (oData, response) {
							var oNotification = oData;
							// Obtengo centro, ubicacion y equipo de la notificacion seleccionada
							oDataModel.read("/PlantSet", {
								success: function (oData, response) {
									oNewOrder.Planplant = oData.results[0];
									that._loadEntities(oNewOrder.Planplant.Werks, dfdEquipments, dfdFuncLocs, dfdGroups);
								},
								error: function (oError) {
									that.getView().setBusy(false);

									oDataModel.fireRequestFailed(oError);
								},
								filters: [new Filter("Werks", FilterOperator.EQ, oNotification.Maintplant)]
							});

							$.when(dfdEquipments, dfdFuncLocs, dfdGroups).then(
								function () {
									/*oNewOrder.FunctLoc = oLocalModel.getProperty("/FunctionalLocations").filter(function (f) {
										return f.Functlocation === oNotification.FunctLoc;
									})[0];*/ //oNotification.Functlocation)[0];
									oNewOrder.FunctLoc = oLocalModel.getProperty("/FunctLocSelected");
									oLocalModel.setProperty("/EquipSelected", oNotification.Equipment)
									oNewOrder.Equipment = oLocalModel.getProperty("/EquipSelected");
									that._loadEquipData();
									/*oLocalModel.getProperty("/Equipments").filter(function (e) {
										return e.Equipment === oNotification.Equipment;
									})[0];*/
									oNewOrder.Plangroup = oNotification.Plangroup;
									oNewOrder.MnWkCtr = oNotification.MnWkCtr;
									oLocalModel.setProperty("/Order", oNewOrder);
									that.getView().setBusy(false);
								},
								function () {
									that.getView().setBusy(false);
								}
							);
						},
						error: function (oError) {
							that.getView().setBusy(false);

							oDataModel.fireRequestFailed(oError);
						}
					});
			} else {
				this._blankEntities();
				oLocalModel.setProperty("/Order", oNewOrder);
			}
		},

		/* =========================================================== */
		/* events                                                      */
		/* =========================================================== */

		openFuncLocsDialog: function (oEvent) {
			/*	if (!this._funcLocsDialog) {
					this._funcLocsDialog = sap.ui.xmlfragment("com.blueboot.createorders.view.FunctionalLocationsDialog", this);
					this.getView().addDependent(this._funcLocsDialog);
				}
				this._funcLocsDialog.open();*/
			var localModel = sap.ui.getCore().getModel();
			localModel.setProperty("/FilterCriteria", "FuncLocSet");
			this.openSearcher();
		},

		openEquipmentsDialog: function (oEvent) {
			if (!this._equipDialog) {
				this._equipDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.EquipmentsDialog", this);
				this.getView().addDependent(this._equipDialog);
			}
			this._equipDialog.open();
			/*var localModel = sap.ui.getCore().getModel();
			localModel.setProperty("/FilterCriteria", "EquipSet");
			this.openSearcher();*/
		},

		_handlePlantSearch: function (oEvent) {
			var sQuery = oEvent.getParameter("value"),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				that = this;
			if (!sQuery) {
				return;
			}
			this._plantsDialog.setBusy(true);
			oDataModel.read("/PlantSet", {
				success: function (oData, response) {
					that._plantsDialog.setBusy(false);
					//no estamos filtrando nada
					oLocalModel.setProperty("/Plants", oData.results, oLocalModel, true);
				},
				error: function (oError) {
					oLocalModel.setProperty("/busy", false);

					oDataModel.fireRequestFailed(oError);
				},
				filters: [new Filter("Werks", FilterOperator.EQ, sQuery.toUpperCase())]
			});
		},
		
		handlePlantSearch: function (evt) {
	      var sValue = evt.getParameter("value");
	      var oFilter = new Filter({
	        filters: [
	          new Filter("Werks", sap.ui.model.FilterOperator.Contains, sValue),
	          new Filter("Name1", sap.ui.model.FilterOperator.Contains, sValue)
	        ],
	        and: false
	      });
	      //this.getView().byId("searchResultsList").getBinding("items").filter([oFilter]); //searcherFragment--resultsList esta es la id?
	      evt.getSource().getBinding("items").filter([oFilter]);
	    },

		handlePlantConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				oPlant = oLocalModel.getProperty(oSelectedItem.getBindingContextPath());
			oLocalModel.setProperty(this._plantsDialog.path, oPlant);

			this._loadEntities(oPlant.Werks);
		},

		handleFuncLocConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				oFuncLoc = oLocalModel.getProperty(oSelectedItem.getBindingContextPath());
			oLocalModel.setProperty("/Order/FunctLoc", oFuncLoc);
		},

		handleEquipConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				oEquipment = oLocalModel.getProperty(oSelectedItem.getBindingContextPath());
			//oLocalModel.setProperty("/Order/FunctLoc", oEquipment.Functlocation);
			oLocalModel.setProperty("/Order/Equipment", oEquipment);
			oLocalModel.setProperty("/EquipObject", oEquipment);
			oLocalModel.setProperty("/EquipSelected", oEquipment.Equipment);
			oLocalModel.setProperty("/Order/Plangroup", oEquipment.Plangroup);
			var plant = oLocalModel.getProperty("/Plants").filter(function (p) {
				return p.Werks === oEquipment.Planplant;
			})[0];
			oLocalModel.setProperty("/Order/Planplant", plant);
			this._loadEquipData();
		},

		handleEquipLiveChange: function (oEvent) {
			var sQuery = oEvent.getParameter("value"),
				oSelectDialog = oEvent.getSource(),
				oItemsBinding = oSelectDialog.getBinding("items");
			oItemsBinding.filter(new Filter({
				filters: [new Filter("Equipment", FilterOperator.Contains, sQuery), new Filter("Descript", FilterOperator.Contains, sQuery)],
				and: false
			}));
		},
		
		handleEquipEnter: function (oEvent) {
			var equip = oEvent.getParameter("value"),
				localModel = sap.ui.getCore().getModel(),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				that = this;
			
			localModel.setProperty("/EquipSelected", equip, localModel, true);
			this._loadEquipData();
		},

		_loadEquipData: function(){
			var localModel = sap.ui.getCore().getModel(),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				equip = localModel.getProperty("/EquipSelected"),
				that = this;
			oDataModel.read("EquipSet('" + equip + "')", {
				success: function (odata) {
					var oEquip = odata;
					oEquip.Id = oEquip.Equipment;
					oEquip.description = oEquip.Descript;
					var dfdWorkCenters = $.Deferred();
		
					var plant = localModel.getProperty("/Plants").filter(function (p) {
							return p.Werks === oEquip.Planplant;
						})[0],
						order = localModel.getProperty("/Order");
					order.Plangroup = oEquip.Plangroup;
					order.Planplant = plant;
		
					localModel.setProperty("/Order", order);
					localModel.setProperty("/EquipObject", oEquip);
					
					that._loadEntities(oEquip.Planplant, undefined, undefined, undefined, dfdWorkCenters);
					$.when(dfdWorkCenters).then(function () {
						var aWorkCenters = localModel.getProperty("/PmWorkCenters");
		
						if (oEquip) {
							var oOrder = localModel.getProperty("/Order"),
								oWorkCenter = aWorkCenters.filter(function (w) {
									return w.Objid === oEquip.Workcenter;
								})[0];
							oOrder.MnWkCtr = oWorkCenter;
							oOrder.FunctLoc = oEquip.Functlocation;
							localModel.setProperty("/Order", oOrder);
							order.OrderOperationSet = [{
								Activity: "10",
								ControlKey: "PM01",
								Plant: oOrder.Planplant,
								Description: oOrder.ShortText,
								WorkCntr: oOrder.MnWkCtr.Arbpl,
								WorkActual: 0
							}];
							localModel.setProperty("/ParentOperations", order.OrderOperationSet);
						}
					});
				},
				error: function (oError) {
					sap.m.MessageToast.show("Invalid Equipment");
				}
			});
		},

		/*_loadEquipData: function(){
			var localModel = sap.ui.getCore().getModel(),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				equip = localModel.getProperty("/EquipSelected"),
				oEquip= localModel.getProperty("/EquipObject");
			var dfdWorkCenters = $.Deferred();
			this._loadEntities(oEquip.Planplant, undefined, undefined, undefined, dfdWorkCenters);
			$.when(dfdWorkCenters).then(function () {
				var aWorkCenters = localModel.getProperty("/PmWorkCenters");
				oEquip= localModel.getProperty("/EquipObject");
				if (oEquip) {
					var oOrder = localModel.getProperty("/Order"),
						oWorkCenter = aWorkCenters.filter(function (w) {
							return w.Objid === oEquip.Workcenter;
						})[0];
					oOrder.MnWkCtr = oWorkCenter;
					oOrder.FunctLoc = oEquip.Functlocation;
					localModel.setProperty("/Order", oOrder);
					oOrder.OrderOperationSet = [{
						Activity: "10",
						ControlKey: "PM01",
						Plant: oOrder.Planplant,
						Description: oOrder.ShortText,
						WorkCntr: oOrder.MnWkCtr.Arbpl,
						WorkActual: 0
					}];
					localModel.setProperty("/ParentOperations", oOrder.OrderOperationSet);
				}
			});
		},*/
		
		handleFuncLocLiveChange: function (oEvent) {
			var sQuery = oEvent.getParameter("value"),
				oSelectDialog = oEvent.getSource(),
				oItemsBinding = oSelectDialog.getBinding("items");
			oItemsBinding.filter(new Filter({
				filters: [new Filter("Functlocation", FilterOperator.Contains, sQuery), new Filter("Descript", FilterOperator.Contains, sQuery)],
				and: false
			}));

		},

		handleMaterialLiveChange: function (oEvent) {
			var sQuery = oEvent.getParameter("value"),
				oSelectDialog = oEvent.getSource(),
				oItemsBinding = oSelectDialog.getBinding("items");
			oItemsBinding.filter(new Filter({
				filters: [new Filter("RId", FilterOperator.Contains, sQuery), new Filter("RVal1", FilterOperator.Contains, sQuery)],
				and: false
			}));

		},

		handleWorkCenterLiveChange: function (oEvent) {
			var sQuery = oEvent.getParameter("value"),
				oSelectDialog = oEvent.getSource(),
				oItemsBinding = oSelectDialog.getBinding("items");
			oItemsBinding.filter(new Filter({
				filters: [new Filter("Arbpl", FilterOperator.Contains, sQuery), new Filter("Ktext", FilterOperator.Contains, sQuery)],
				and: false
			}));
		},

		handleWorkCenterConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				oWorkCenter = oLocalModel.getProperty(oSelectedItem.getBindingContextPath());
			oLocalModel.setProperty(this._workCentersDialog.path, oWorkCenter.Arbpl);
		},

		onBlankOrder: function (oEvent) {
			var oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = {};
			oNewOrder.OrderOperationSet = [];
			oNewOrder.OrderComponentSet = [];
			oLocalModel.setProperty("/Order", oNewOrder);
			this._blankEntities();
		},

		handleOperationEdit: function (oEvent) {
			var currentContext = oEvent.getParameter("listItem").getBindingContext().getPath();
			this.handleAddOperationPress(oEvent, currentContext);
		},

		handleAddOperationPress: function (oEvent, currentContext) {
			var oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = oLocalModel.getProperty("/Order"),
				oNewOperation = {};

			if (currentContext) {
				oNewOperation = oLocalModel.getProperty(currentContext);
			} else {
				oNewOperation.Plant = oLocalModel.getProperty("/Order/Planplant");
				oNewOperation.WorkActual = 0;
				oNewOrder.OrderOperationSet.push(oNewOperation);
				currentContext = "/Order/OrderOperationSet/" + (oNewOrder.OrderOperationSet.length - 1);
			}

			if (oNewOperation.Plant) {
				this._loadOpWorkCenters(oNewOperation.Plant.Werks);
			} else {
				oLocalModel.setProperty("/OpWorkCenters", []);
			}

			if (!this._addOperationDialog) {
				var fragID = this.getView().createId("opFrag");
				this._addOperationDialog = sap.ui.xmlfragment(fragID, "com.blueboot.createorder.view.AddOperation", this);
				this.getView().addDependent(this._addOperationDialog);
			}
			this._addOperationDialog.bindElement(currentContext);
			this._addOperationDialog.open();
		},

		handleComponentEdit: function (oEvent) {
			var currentContext = oEvent.getParameter("listItem").getBindingContext().getPath();
			this.handleAddComponentPress(oEvent, currentContext);
		},

		handleAddComponentPress: function (oEvent, currentContext) {
			var oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = oLocalModel.getProperty("/Order"),
				oNewComponent = {};

			if (currentContext) {
				oNewComponent = oLocalModel.getProperty(currentContext);
			} else {
				oNewComponent.ResItem = oNewOrder.OrderComponentSet.length ? (parseInt(oNewOrder.OrderComponentSet[oNewOrder.OrderComponentSet.length -
					1].ResItem) + 10).toString() : "10";
				oNewComponent.Plant = oLocalModel.getProperty("/Order/Planplant");
				oNewOrder.OrderComponentSet.push(oNewComponent);
				currentContext = "/Order/OrderComponentSet/" + (oNewOrder.OrderComponentSet.length - 1);
			}

			if (oNewComponent.Plant) {
				this._loadMaterials(oNewComponent.Plant.Werks);
			} else {
				oLocalModel.setProperty("/Materials", []);
			}
			oLocalModel.setProperty("/StgeLocs", []);

			if (!this._addComponentDialog) {
				this._addComponentDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.AddComponent", this);
				this.getView().addDependent(this._addComponentDialog);
			}
			oLocalModel.setProperty("/currentComponent", currentContext);
			this._addComponentDialog.bindElement(currentContext);
			this._addComponentDialog.open();
		},

		onPlantsDialog: function (oEvent) {
			this._openPlantsDialog();
			this._plantsDialog.path = "/Order/Planplant";
		},

		onOperationPlantsDialog: function (oEvent) {
			this._openPlantsDialog();
			this._plantsDialog.path = oEvent.getSource().getParent().getBindingContext().getPath() + "/Plant";
		},

		onComponentPlantsDialog: function (oEvent) {
			this._openPlantsDialog();
			this._plantsDialog.path = oEvent.getSource().getParent().getBindingContext().getPath() + "/Plant";
		},

		handleAddOperationCancelPress: function (oEvent) {
			var oLocalModel = sap.ui.getCore().getModel();
			var index = oEvent.getSource().getParent().getBindingContext().getPath().split("/").pop();
			var orderOperations = oLocalModel.getProperty("/Order/OrderOperationSet")
			orderOperations.splice(index, 1);
			oLocalModel.refresh(true);
			this._addOperationDialog.close();
		},

		handleAddComponentCancelPress: function (oEvent) {
			var oLocalModel = sap.ui.getCore().getModel();
			var index = oEvent.getSource().getParent().getBindingContext().getPath().split("/").pop();
			var orderComponents = oLocalModel.getProperty("/Order/OrderComponentSet")
			orderComponents.splice(index, 1);
			oLocalModel.refresh(true);
			this._addComponentDialog.close();
		},

		handleAddOperationAcceptPress: function (oEvent) {
			//No tiene que hacer nada si acepta, se agrego antes de abrir el dialog.
			var oLocalModel = sap.ui.getCore().getModel();
			var order = oLocalModel.getProperty("/Order");
			var index = oEvent.getSource().getParent().getBindingContext().getPath().split("/").pop();
			var orderOperations = oLocalModel.getProperty("/Order/OrderOperationSet")
			if (!orderOperations[index].Activity) {
				orderOperations[index].Activity = order.OrderOperationSet.length > 1 ? (parseInt(order.OrderOperationSet[order.OrderOperationSet.length -
					2].Activity) + 10).toString() : "10";
			}
			if (!orderOperations[index].SubActivity) {
				var parentOperations = oLocalModel.getProperty("/ParentOperations");
				if (parentOperations.findIndex(function (o) {
						return o.Activity === orderOperations[index].Activity;
					}) < 0) {
					parentOperations.push(orderOperations[index]);
				}
			}

			order.OrderOperationSet = order.OrderOperationSet.sort(function (a, b) {
				//Pondero el Activity xq ordeno por esto primero.
				if (a.SubActivity && b.SubActivity) {
					return (a.Activity - b.Activity) * 10 + (a.SubActivity - b.SubActivity)
				} else {
					return (a.Activity - b.Activity) * 10;
				}
			});
			oLocalModel.refresh(true);
			this._addOperationDialog.close();
		},
		
		handleMaterialConfirm: function (oEvent) {
			var oLocalModel = sap.ui.getCore().getModel(),
				oSelectedItem = oEvent.getParameter("selectedItem"),
				oMaterial = oLocalModel.getProperty(oSelectedItem.getBindingContextPath());
			oLocalModel.setProperty(oLocalModel.getProperty("/currentComponent") + "/Material", oMaterial.RId);
			oLocalModel.setProperty(oLocalModel.getProperty("/currentComponent") + "/MatlDesc", oMaterial.RVal1);
			//this._loadStorageLocations();
		},

		handleAddComponentAcceptPress: function (oEvent) {
			var oLocalModel = sap.ui.getCore().getModel(),
				oMaterial = oLocalModel.getProperty(oLocalModel.getProperty("/currentComponent")),
				oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oBusyDialog = new BusyDialog(),
				that = this;
			oBusyDialog.open();
			oDataModel.callFunction(
				"/PesquisaAlmoxarifado",
				"GET", {
					Matnr: oMaterial.Material
				},
				null,
				function (oData, response) {
					oBusyDialog.close();
					if (oData.results.length > 0) {
						oLocalModel.setProperty("/StgeLocs", oData.results);

						if (!that.locationsDialog) {
							that.locationsDialog = new sap.m.Dialog({
								title: "Material " + oMaterial.Material,
								content: new sap.m.Table({
									columns: [
										new sap.m.Column({
											header: new sap.m.Label({
												text: "Depósito"
											})
										}), new sap.m.Column({
											header: new sap.m.Label({
												text: "Descrição depósito"
											})
										}), new sap.m.Column({
											header: new sap.m.Label({
												text: ""
											})
										})
									],
									items: {
										path: '/StgeLocs',
										template: new sap.m.ColumnListItem({
											type: "Active",
											cells: [
												new sap.m.Text({
													text: "{Alcc}"
												}),
												new sap.m.Text({
													text: "{Dpor}"
												}),
												new sap.m.Text({
													text: "{Acnn}"
												})
											],
											press: function (evt) {
												that.locationsDialog.close();
												var stageLoc = evt.getSource().getBindingContext().getObject();
												if (parseFloat(stageLoc.Acnn) < parseFloat(oMaterial.RequirementQuantity)) {
													MessageBox.confirm(
														"Solicitada " + oMaterial.RequirementQuantity + ". No depósito " +
														stageLoc.Alcc + " existem " + stageLoc.Acnn + ". Confirma a solitição?", {
															styleClass: "sapUiSizeCompact",
															onClose: function(oAction) {
																if (oAction === MessageBox.Action.OK) {
																	oMaterial.StgeLoc = stageLoc.Alcc;
																	oMaterial.RequirementQuantity = stageLoc.Acnn;
																	oLocalModel.setProperty(oLocalModel.getProperty("/currentComponent"), oMaterial);
																	//No hay que hacer nada con los componentes, ya fue agregado.
																	that._addComponentDialog.close();
																}
															}
														}
													);
												} else {
													oMaterial.StgeLoc = stageLoc.Alcc;
													oLocalModel.setProperty(oLocalModel.getProperty("/currentComponent"), oMaterial);
													//No hay que hacer nada con los componentes, ya fue agregado.
													that._addComponentDialog.close();
												}
											}
										})
									}
								}),
								beginButton: new sap.m.Button({
									text: '{i18n>CANCEL}',
									press: function () {
										that.locationsDialog.close();
									}.bind(that)
								})
							});
						}

						that.locationsDialog.open();
						//to get access to the global model
						that.getView().addDependent(that.locationsDialog);
					} else {
						var oHeader = JSON.parse(response.headers["sap-message"]),
							sMsg = oHeader.message;
						MessageBox.error(sMsg);
					}
				},
				function (oError) {
					oBusyDialog.close();
				});
		},

		onWorkCentersDialog: function (oEvent) {
			this._openWorkCentersDialog("WorkCentersDialog");
			this._workCentersDialog.path = "/Order/MnWkCtr";
		},

		onOperationWorkCentersDialog: function (oEvent) {
			this._openWorkCentersDialog("OperationWorkCentersDialog");
			this._workCentersDialog.path = oEvent.getSource().getParent().getBindingContext().getPath() + "/WorkCntr";
		},

		handleOperationDelete: function (oEvent) {
			var oTable = oEvent.getSource(),
				oItem = oEvent.getParameter("listItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				aOrder = oLocalModel.getProperty("/Order"),
				parentOperations = oLocalModel.getProperty("/ParentOperations"),
				oOperation = oLocalModel.getProperty(oItem.getBindingContextPath());
			aOrder.OrderOperationSet = aOrder.OrderOperationSet.filter(function (o) {
				return o.Activity !== oOperation.Activity;
			});
			aOrder.OrderComponentSet = aOrder.OrderComponentSet.filter(function (o) {
				return o.Activity !== oOperation.Activity;
			});
			parentOperations = parentOperations.filter(function (o) {
				return o.Activity !== oOperation.Activity;
			});
			// Reparo indices      
			/*for (var i in aOperations) {
				aOperations[i].Activity = (i + 1) * 10;
			}*/

			oLocalModel.setProperty("/ParentOperations", parentOperations);
			oLocalModel.refresh();
		},

		handleComponentDelete: function (oEvent) {
			var oTable = oEvent.getSource(),
				oItem = oEvent.getParameter("listItem"),
				oLocalModel = sap.ui.getCore().getModel(),
				aComponents = oLocalModel.getProperty("/Order/OrderComponentSet"),
				oComponent = oLocalModel.getProperty(oItem.getBindingContextPath());
			aComponents = aComponents.filter(function (o) {
				return o.ResItem !== oComponent.ResItem;
			});
			// Reparo indices      
			/*for (var i in aComponents) {
				aComponents[i].ResItem = (i + 1) * 10;
			}*/
			oLocalModel.setProperty("/Order/OrderComponentSet", aComponents);
		},

		onMaterialsDialog: function (oEvent) {
			if (this._materialsDialog) {
				this._materialsDialog.destroy();
			}
			this._materialsDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.MaterialsDialog", this);
			this.getView().addDependent(this._materialsDialog);
			this._materialsDialog.open();
		},

		openTaskListsDialog: function (oEvent) {
			if (this._taskListsDialog) {
				this._taskListsDialog.destroy();
			}
			this._taskListsDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.TaskListsDialog", this);
			this.getView().addDependent(this._taskListsDialog);
			this._taskListsDialog.open();
			var oLocalModel = sap.ui.getCore().getModel();
			oLocalModel.setProperty("/searchByObject", false);
		},

		onSearchTaskList: function (oEvent) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = oLocalModel.getProperty("/Order"),
				that = this,
				aFilters = [],
				sPlnty;
			if (oLocalModel.getProperty("/searchByObject")) {
				if (oNewOrder.Equipment) {
					sPlnty = "E"; // General
					aFilters.push(new Filter("Equnr", FilterOperator.EQ, oNewOrder.Equipment.Equipment));
				} else if (oNewOrder.FunctLoc) {
					sPlnty = "T"; // General
					aFilters.push(new Filter("Tplnr", FilterOperator.EQ, oNewOrder.FunctLoc.Functlocation));
				} else {
					MessageBox.error(this.getResourceBundle().getText("NO_OBJECT"));
					return;
				}
			} else {
				if (oNewOrder.Planplant) {
					sPlnty = "A"; // General
					aFilters.push(new Filter("Werks", FilterOperator.EQ, oNewOrder.Planplant.Werks));
				} else {
					MessageBox.error(this.getResourceBundle().getText("NO_PLANT"));
					return;
				}
			}
			aFilters.push(new Filter("Plnty", FilterOperator.EQ, sPlnty));
			this._oBusyDialog.open();
			oDataModel.read("/TaskListSet", {
				success: function (oData, response) {
					oLocalModel.setProperty("/TaskLists", oData.results);
					that._oBusyDialog.close();
				},
				error: function (oError) {
					that._oBusyDialog.close();
					oError.customMessage = that.getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
					oDataModel.fireRequestFailed(oError);
				},
				filters: aFilters
			});

		},

		onCloseTaskListDialog: function (oEvent) {
			this._taskListsDialog.close();
		},

		handleTaskListPress: function (oEvent) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				oNewOrder = oLocalModel.getProperty("/Order"),
				that = this,
				oListItem = oEvent.getSource(),
				oTaskList = oLocalModel.getProperty(oListItem.getBindingContextPath());
			this._oBusyDialog.open();
			oDataModel.read("/TaskListSet(Plnnr='" + oTaskList.Plnnr + "',Plnty='" + oTaskList.Plnty + "',Plnal='" + oTaskList.Plnal +
				"')?$expand=OrderOperationSet,OrderPRTSet,OrderComponentSet", {
					success: function (oData, response) {
						oNewOrder.OrderComponentSet = oData.OrderComponentSet.results;
						oNewOrder.OrderOperationSet = oData.OrderOperationSet.results;
						oNewOrder.OrderPRTSet = oData.OrderPRTSet.results;
						oNewOrder.Plangroup = oData.Vagrp;
						oNewOrder.ShortText = oData.Ktext;
						that._loadEntities(oData.Werks);
						oDataModel.read("/PlantSet", {
							success: function (oData, response) {
								oNewOrder.Planplant = oData.results[0];
								oLocalModel.setProperty("/Order", oNewOrder);
								that._oBusyDialog.close();
								this._taskListsDialog.close();
							},
							error: function (oError) {
								that._oBusyDialog.close();
								this._taskListsDialog.close();
								oDataModel.fireRequestFailed(oError);
							},
							filters: [new Filter("Werks", FilterOperator.EQ, oData.Werks)]
						});
					},
					error: function (oError) {
						that._oBusyDialog.close();

						oDataModel.fireRequestFailed(oError);
					}
				});
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_openWorkCentersDialog: function (sFragment) {
			if (this._workCentersDialog) {
				this._workCentersDialog.destroy();
			}
			this._workCentersDialog = sap.ui.xmlfragment("com.blueboot.createorder.view." + sFragment, this);
			this.getView().addDependent(this._workCentersDialog);
			this._workCentersDialog.open();
		},

		_openPlantsDialog: function () {
			if (!this._plantsDialog) {
				this._plantsDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.PlantsDialog", this);
				this.getView().addDependent(this._plantsDialog);
			}
			this._plantsDialog.open();
		},

		_loadEntities: function (sPlant, dfdEquipments, dfdFuncLocs, dfdGroups, dfdWorkCenters) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				that = this;
			if (!this._plantsDialog || this._plantsDialog.path === "/Order/Planplant") {
				// Busco equipos, ubicaciones y grupos de planificacion del centro seleccionado
				/*oLocalModel.setProperty("/loadingFuncLocs", true);
				oLocalModel.setProperty("/loadingEquipments", true);

				oLocalModel.setProperty("/FunctionalLocations", [], oLocalModel, true);
				oLocalModel.setProperty("/Equipments", [], oLocalModel, true);
				oLocalModel.setProperty("/loadingFuncLocs", false);*/
				if (dfdFuncLocs) dfdFuncLocs.resolve();
				if (dfdEquipments) dfdEquipments.resolve();

				/*oDataModel.read("/GEntitySet", {
					success: function (oData, response) {
						if (dfdGroups) {
							dfdGroups.resolve();
						}
						oLocalModel.setProperty("/PlanningGroups", oData.results, oLocalModel, true);
					},
					error: function (oError) {
						if (dfdGroups) {
							dfdGroups.reject();
						}

						oDataModel.fireRequestFailed(oError);
					},
					filters: [
						new Filter("TName", FilterOperator.EQ, "T024I"),
						new Filter("FId", FilterOperator.EQ, "INGRP"),
						new Filter("FVal1", FilterOperator.EQ, "INNAM"),
						new Filter("FWhere", FilterOperator.EQ, "IWERK eq '" + sPlant + "'")
					]
				});*/
				oDataModel.read("/PlanGroupSet", {
					success: function (oData, response) {
						oLocalModel.setProperty("/PlanningGroups", oData.results, oLocalModel, true);
						if (dfdGroups) dfdGroups.resolve();
					},
					error: function (oError) {
						if (dfdGroups) dfdGroups.reject();
						oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
						oDataModel.fireRequestFailed(oError);
					},
					filters: [new sap.ui.model.Filter("IWERK", sap.ui.model.FilterOperator.EQ, sPlant)]
				});

				// Voy sustituyendo los GEntityset paulatinamente
				oDataModel.read("/WorkCenterSet?$expand=PersonSet", {
					success: function (oData, response) {
						oLocalModel.setProperty("/PmWorkCenters", oData.results);
						oLocalModel.setProperty("/OpWorkCenters", oData.results);
						if (dfdWorkCenters) dfdWorkCenters.resolve();
					},
					error: function (oError) {
						if (dfdWorkCenters) dfdWorkCenters.reject();
						oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
						oDataModel.fireRequestFailed(oError);
					},
					filters: [new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, sPlant)]
				});
				//this._loadMaterials(sPlant);
			} else if (this._plantsDialog.path.match(/Order\/OrderOperationSet\/\d\/Plant/g)) {
				// Cargar entidades de operacion
				this._loadOpWorkCenters(sPlant);
			} else {
				// Cargar entidades de componente
				//this._loadMaterials(sPlant);
			}
		},

		_loadMaterials: function (sPlant) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				that = this;
			oLocalModel.setProperty("/loadingMaterials", true);
			oDataModel.read("/GEntitySet", {
				success: function (oData, response) {
					oLocalModel.setProperty("/Materials", oData.results, oLocalModel, true);
					oLocalModel.setProperty("/loadingMaterials", false);
				},
				error: function (oError) {
					oLocalModel.setProperty("/loadingMaterials", false);

					oDataModel.fireRequestFailed(oError);
				},
				filters: [
					new Filter("TName", FilterOperator.EQ, "MARC"),
					new Filter("FId", FilterOperator.EQ, "MATNR"),
					new Filter("FVal1", FilterOperator.EQ, "MATKX"),
					new Filter("FWhere", FilterOperator.EQ, "WERKS eq '" + sPlant + "'")
				]
			});
		},

		_loadStorageLocations: function (oEvent) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel(),
				sMaterial = oLocalModel.getProperty(oLocalModel.getProperty("/currentComponent") + "/Material"),
				sPlant = oLocalModel.getProperty(oLocalModel.getProperty("/currentComponent") + "/Plant/Werks"),
				that = this;

			oDataModel.read("/GEntitySet", {
				success: function (oData, response) {
					oLocalModel.setProperty("/StgeLocs", oData.results, oLocalModel, true);
				},
				error: function (oError) {

					oDataModel.fireRequestFailed(oError);
				},
				filters: [
					new Filter("TName", FilterOperator.EQ, "MARD"),
					new Filter("FId", FilterOperator.EQ, "LGORT"),
					new Filter("FVal1", FilterOperator.EQ, "LGOBE"),
					new Filter("FVal2", FilterOperator.EQ, "LABST"),
					new Filter("FWhere", FilterOperator.EQ, "MATNR eq '" + sMaterial + "' and MARD~WERKS eq '" + sPlant + "'")
				]
			});
		},

		_loadOpWorkCenters: function (sPlant) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel();
				oLocalModel.setProperty("/loadingOpWorkCenters", true);
			oDataModel.read("/WorkCenterSet?$expand=PersonSet", {
		        success: function (oData, response) {
		          oLocalModel.setProperty("/OpWorkCenters", oData.results, oLocalModel, true);
		          oLocalModel.setProperty("/loadingOpWorkCenters", false);
		        },
		        error: function (oError) {
		          oLocalModel.setProperty("/loadingOpWorkCenters", false);
		          oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
		          oDataModel.fireRequestFailed(oError);
		        },
		        filters: [new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, sPlant)]
		      });

		},

		_blankEntities: function () {
			var oLocalModel = sap.ui.getCore().getModel();
			oLocalModel.setProperty("/EquipSelected", "", oLocalModel, true);
			/*oLocalModel.setProperty("/PlanningGroups", [], oLocalModel, true);
			oLocalModel.setProperty("/Equipments", [], oLocalModel, true);
			oLocalModel.setProperty("/FunctionalLocations", [], oLocalModel, true);
			oLocalModel.setProperty("/OpWorkCenters", [], oLocalModel, true);
			oLocalModel.setProperty("/PmWorkCenters", [], oLocalModel, true);*/
		},

		onOrderCreate: function () {
			var that = this;
			
			that._oBusyDialog.open();
			that.getView().setBusy(true);
			/*try {*/
				var oDataModel = sap.ui.getCore().getModel("oDataModel"),
					oLocalModel = sap.ui.getCore().getModel(),
					order = jQuery.extend(true, {}, oLocalModel.getProperty("/Order")),
					oEquipment = oLocalModel.getProperty("/EquipObject");
				order.Planplant = order.Planplant ? order.Planplant.Werks : "";
				//order.FunctLoc = oLocalModel.getProperty("/FunctLocSelected"); //order.FunctLoc ? order.FunctLoc.Functlocation : "";
				order.Equipment = oLocalModel.getProperty("/EquipSelected"); //order.Equipment ? order.Equipment.Equipment : "";
				order.MnWkCtr = order.MnWkCtr.Arbpl;
				order.Breakdown = order.Breakdown ? "X" : "";
				order.Equicatgry = oEquipment.Equicatgry;

				/*if (oLocalModel.getProperty("/ReleaseOrder")) {
					order.Release = "X";
				}*/
				// PS - Mercedes libera automaticamente
				order.Release = "X";

				for (var i in order.OrderOperationSet) {
					order.OrderOperationSet[i].Plant = order.OrderOperationSet[i].Plant ? order.OrderOperationSet[i].Plant.Werks : "";
					order.OrderOperationSet[i].Activity = order.OrderOperationSet[i].Activity.padStart(4, "0");
					order.OrderOperationSet[i].WorkActual = order.OrderOperationSet[i].WorkActual.toString();
					var subact = order.OrderOperationSet[i].SubActivity;
					if (subact != null && subact != "") {
						order.OrderOperationSet[i].SubActivity = subact.padStart(4, "0");
					}
				}
				for (var i in order.OrderComponentSet) {
					order.OrderComponentSet[i].Plant = order.OrderOperationSet[i].Plant ? order.OrderComponentSet[i].Plant.Werks : "";
					order.OrderComponentSet[i].Activity = order.OrderComponentSet[i].Activity.padStart(4, "0");
				}
				//  PS - Hago llamada sin componentes, guardo en objeto para enviar componentes en un segundo llamado.
				var oOrderComponents = {
					OrderComponentSet: order.OrderComponentSet
				};
				order.OrderComponentSet = [];
				
				var oFileUploader = that.getView().byId("photoFileUploader");

				var base64_marker = ";base64,";
				var orderPhotoSet = [];
				var orderPhotoType = [];
				var orderPhotoFname = [];
				var readAllFiles = $.Deferred();
				if (oFileUploader && oFileUploader.oFileUpload && oFileUploader.oFileUpload.files && oFileUploader.oFileUpload.files.length) {
					var base64_marker = ";base64,";
					var file;
					var fileCount = oFileUploader.oFileUpload.files.length;
					for (var i in Object.keys(oFileUploader.oFileUpload.files)) {
						file = oFileUploader.oFileUpload.files[i];
						var reader = new FileReader();
						reader.onload = function (oEvent) {
							var fileContent = oEvent.target.result;
							var base64index = fileContent.indexOf(base64_marker);
							//Para que el pedido odata funcione, el base64 no tiene que tener el marker.
							var base64 = fileContent.substring(base64index + base64_marker.length).match(/.{1,76}/g).join("\n");
							orderPhotoSet.push(base64);
							orderPhotoType.push(file.type);
							orderPhotoFname.push(file.name)
							fileCount--;
							if (fileCount === 0) {
								readAllFiles.resolve();
							}
						};
						reader.readAsDataURL(file);
					}
				} else {
					readAllFiles.resolve();
				}
				$.when(readAllFiles).then(function () {
					oDataModel.create("/OrderSet", order, {
						success: function (oData, response) {
							var dfdOrderPhoto = $.Deferred();
							var orderPhotoCount = orderPhotoSet.length;
							if (orderPhotoCount > 0) {
								for (var i in orderPhotoSet) {
									var sPath = new URL(oData.__metadata.uri).href.split(oDataModel.sServiceUrl)[1] + "/OrderPhotoSet"
									oDataModel.setHeaders({
										"slug": orderPhotoFname[i]
									});
									oDataModel.create(sPath, orderPhotoSet[i], {
										success: function (data) {
											orderPhotoCount--;
											if (orderPhotoCount === 0) {
												oDataModel.setHeaders(that._originalHeaders);
												dfdOrderPhoto.resolve();
											}
										},
										error: function (err) {
											orderPhotoCount--;
											if (orderPhotoCount === 0) {
												oDataModel.setHeaders(that._originalHeaders);
												dfdOrderPhoto.reject();
											}
										}
									});
								}
							} else {
								dfdOrderPhoto.resolve();
							}
							$.when(dfdOrderPhoto).then(function () {
								var match = oData.__metadata.uri.match(/\((.*)?\)/);
								var msgSuc = that._oBundle.getText("CREATE_ITEM_OFFLINE");
								if (match && match[1]) {
									msgSuc = that._oBundle.getText("SUCCESS_CREATE", [match[1]]);
									oOrderComponents.Orderid = [match[1]];
								}
								that._oBusyDialog.close();
								that.getView().setBusy(false);
								sap.m.MessageBox.success(msgSuc, {
									onClose: function () {
										if (!sap.ui.Device.system.phone) {
											that.getRouter().navTo("empty", {}, true);
										} else {
											that.getRouter().navTo("master", {}, true);
										}
									}
								});
							});
						},
						error: function (oError) {
							oDataModel.fireRequestFailed(oError);
							that._oBusyDialog.close();
							that.getView().setBusy(false);
						}
					});
				});
			/*} catch (e) {
				that._oBusyDialog.close();
				that.getView().setBusy(false);
				sap.m.MessageBox.error(e.message);
			}*/
		},

		orderTypeChanged: function (oEvent) {
			var orderType = oEvent.getParameter("selectedItem").getKey();
			var oDataModel = sap.ui.getCore().getModel("oDataModel"),
				oLocalModel = sap.ui.getCore().getModel();
			if(orderType == "PM10"){
				oLocalModel.setProperty("/Order/Breakdown", true);
			} else {
				oLocalModel.setProperty("/Order/Breakdown", false);
			}
			var classes = oLocalModel.getProperty("/ActClasses").filter(function(x) {
					return x.AUART === orderType;	
				});;
			oLocalModel.setProperty("/Classes", classes);
			// PS - Mercedes, no se de donde viene la logica, por el momento replico por codigo
			if (classes.filter(function (t) {
					return t.ILART === "CR";
				}).length > 0) {
				// Si tiene corretiva se setea por defecto
				oLocalModel.setProperty("/Order/Pmacttype", "CR");
			} else {
				// Se setea la primer opción por defecto
				if(orderType == "PM22"){
					oLocalModel.setProperty("/Order/Pmacttype", "PT");
				} else {
					oLocalModel.setProperty("/Order/Pmacttype", classes[0].ILART);
				}
			}
		},
		opOrSubopChoose: function (selected) {
			var subOp = !selected.getParameter("selected");
			var fragmentId = this.getView().createId("opFrag");
			sap.ui.core.Fragment.byId(fragmentId, "lblOp").setVisible(subOp);
			sap.ui.core.Fragment.byId(fragmentId, "selOp").setVisible(subOp);
			sap.ui.core.Fragment.byId(fragmentId, "lblSOp").setVisible(subOp);
			sap.ui.core.Fragment.byId(fragmentId, "inSOp").setVisible(subOp);
		},
		/******************* VARIANT FUNCTIONS ********************/

		/*openSearcher: function () {

			var searcher = this._getSearcher();
			var localModel = sap.ui.getCore().getModel();

			var filterCriteria = localModel.getProperty("/FilterCriteria");
			var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
			var oConditionsPage = sap.ui.core.Fragment.byId("searcherFragment", filterCriteria);
			oNavCon.to(oConditionsPage);

			searcher.open();

			if (!localModel.getProperty("/Variant")) {
				this.getFields();
			}
		},*/

		openSearcher: function () {

	      var searcher = this._getSearcher();
	      var localModel = sap.ui.getCore().getModel();
	      var filterCriteria = localModel.getProperty("/FilterCriteria");

	      var oFragment = sap.ui.xmlfragment("searcherPage", "com.blueboot.createorder.view." + filterCriteria, this);
	      oFragment.setModel(sap.ui.getCore().getModel("i18n"), "i18n");
	      oFragment.setModel(sap.ui.getCore().getModel());
	      var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
	      oNavCon.addPage(oFragment);
	      var oConditionsPage = sap.ui.core.Fragment.byId("searcherPage", filterCriteria);
	      oNavCon.to(oConditionsPage);

	      searcher.open();

	      this.getFields();
	    },
		
		onVariantAfterClose: function(oEvent) {
			this._oSearcher.destroy();
			
			this._oSearcher = undefined;
		},

		_getSearcher: function () {
			if (this._oSearcher) {
		        this._oSearcher.destroy();
		        this._oSearcher = null;
		    }
		    this._oSearcher = sap.ui.xmlfragment("searcherFragment", "com.blueboot.createorder.view.Variant", this);
		    this._oSearcher.setModel(sap.ui.getCore().getModel("i18n"), "i18n");
		    this._oSearcher.setModel(sap.ui.getCore().getModel());
		    this.getView().addDependent(this._oSearcher);

		    return this._oSearcher;
		},

		closeSearcher: function () {
			this._getSearcher().close();
		},

		getFields: function () {
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var localModel = sap.ui.getCore().getModel();
			var oBusyDialog = new BusyDialog();
			var filterCriteria = localModel.getProperty("/FilterCriteria");
			var report;

			switch (filterCriteria) {
			case "FuncLocSet":
				report = "RIIFLO20";
				break;
			case "EquipSet":
				report = "RIEQUI20";
				break;
			}

			var dfdVariant = $.Deferred();
			oBusyDialog.open();
			oDataModel.read("/VariantSet(Report='" + report + "',VariantName='" + config.DefaultVariantName +
				"')?$expand=VariantObjectsSet,VariantValutabSet", {
					success: function (oData, response) {
						dfdVariant.resolve();
						localModel.setProperty("/Variant", oData);

						oData.VariantObjectsSet.results.forEach(function (object) {
							var field = {
								Name: object.Name,
								Text: object.Text,
								Conditions: [],
								Low: "",
								High: ""
							};
							localModel.setProperty("/" + field.Name, field);
						});
					},
					error: function (oError) {
						oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
						oDataModel.fireRequestFailed(oError);
						oBusyDialog.close();
					}
				});

			$.when(dfdVariant).then(function () {
				oBusyDialog.close();
			});
		},
		navToConditions: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			//var indexField = "/" + oEvent.getParameters().id.split("--")[1];
			var indexField = "/" + oEvent.getSource().getParent().mBindingInfos.label.binding.sPath.split("/")[1];;
			
			localModel.setProperty("/IndexField", indexField);
			localModel.setProperty("/ShowValueHelp", oEvent.getSource().getParent().getFields()[0].getShowValueHelp());

			var conditions = localModel.getProperty(indexField).Conditions;
			var conditionsOriginal = [];

			for (var i in conditions) {
				conditionsOriginal.push(conditions[i]);
			}

			if (!conditionsOriginal.length) {
				localModel.setProperty("/AddVisible", true);
			} else {
				localModel.setProperty("/AddVisible", false);
			}

			localModel.setProperty("/FieldConditionsOriginal", conditionsOriginal);
			localModel.setProperty("/FieldConditions", conditions);
			var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
			var oConditionsPage = sap.ui.core.Fragment.byId("searcherFragment", "conditions");
			oNavCon.to(oConditionsPage);
		},
		addCondition: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var conditions = localModel.getProperty("/FieldConditions");
			var condition = {
				Low: "",
				High: "",
				Operator: "EQ",
				Add: true
			};

			if (conditions.length) {
				var lastCondition = conditions[conditions.length - 1];
				lastCondition.Add = false;
				conditions[conditions.length - 1] = lastCondition;
			}

			conditions.push(condition);
			localModel.setProperty("/FieldConditions", conditions);
			localModel.setProperty("/AddVisible", false);
		},
		removeCondition: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var conditions = localModel.getProperty("/FieldConditions");
			var index = oEvent.getSource().getBindingContext().sPath.substr(-1);
			conditions.splice(index, 1);
			if (!conditions.length) {
				localModel.setProperty("/AddVisible", true);
			} else {
				var lastCondition = conditions[conditions.length - 1];
				lastCondition.Add = true;
				conditions[conditions.length - 1] = lastCondition;
			}
			localModel.setProperty("/FieldConditions", conditions);
		},
		approveConditions: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var indexField = localModel.getProperty("/IndexField");
			var field = localModel.getProperty(indexField);
			var conditions = localModel.getProperty("/FieldConditions");

			field.Conditions = conditions;
			localModel.setProperty(indexField, field);
			var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
			oNavCon.back();
			this.getView().getModel().updateBindings(true);
		},
		cancelConditions: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var conditionsOriginal = localModel.getProperty("/FieldConditionsOriginal");
			var indexField = localModel.getProperty("/IndexField");
			var field = localModel.getProperty(indexField);
			field.Conditions = conditionsOriginal;
			localModel.setProperty(indexField, field);
			var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
			oNavCon.back();
		},
		cancelSearch: function (oEvent) {
			this.closeSearcher();
		},
		acceptSearch: function (oEvent) {
			var that = this;
			var localModel = sap.ui.getCore().getModel();
			var variant = localModel.getProperty("/Variant");
			var variantValutab = [];
			var fieldsToFilter = this.getTabFields();

			//create ValuTab for POST
			variant.VariantObjectsSet.results.forEach(function (object) {
				var field = localModel.getProperty("/" + object.Name);

				var fieldToFilter = fieldsToFilter.find(function (f) {
					return f.Name === object.Name;
				});

				if (fieldToFilter) {
					if (field.Conditions.length) {
						field.Conditions.forEach(function (condition) {
							var valuTab = {
								Selname: object.Name,
								Kind: "S",
								Sign: "I",
								Option: condition.Operator,
								Low: condition.Low,
								High: condition.High
							};
							variantValutab.push(valuTab);
						});
					} else {
						if (field.Low) {
							var valuTab = {
								Selname: object.Name,
								Kind: "S",
								Sign: "I",
								Option: "EQ",
								Low: field.Low,
								High: ""
							};

							if (field.High) {
								valuTab.High = field.High;
								valuTab.Option = "BT";
							}

							variantValutab.push(valuTab);
						}

					}
				}

				delete object.__metadata;
			});

			//Check if at least one filter was added
			if (!variantValutab.length) {
				sap.m.MessageBox.warning(sap.ui.getCore().getModel("i18n").getResourceBundle().getText("MessageAddFilter"));
				return;
			}

			var variantSet = {
				Report: variant.Report,
				VariantName: variant.VariantName,
				VariantObjectsSet: variant.VariantObjectsSet.results,
				VariantValutabSet: variantValutab
			};

			var busyDialog = new sap.m.BusyDialog();
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			busyDialog.open();
			oDataModel.create("/VariantSet", variantSet, {
				success: function (oData, response) {
					busyDialog.close();
					that.getVariantValues();
				},
				error: function (oError) {
					busyDialog.close();
				}
			});
		},
		getVariantValues: function () {
			var localModel = sap.ui.getCore().getModel();
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var oBusyDialog = new BusyDialog();
			var that = this;
			oBusyDialog.open();
			var navigationEntity = localModel.getProperty("/FilterCriteria")
			var variant = localModel.getProperty("/Variant");
			var queryURL = "/VariantSet(Report='" + encodeURIComponent(variant.Report) + "',VariantName='" + encodeURIComponent(variant.VariantName) +
				"')/" + encodeURIComponent(navigationEntity);
			oDataModel.read(queryURL, {
				success: function (oData, response) {
					var searchResults;
					switch (navigationEntity) {
					case "FuncLocSet":
						searchResults = oData.results.map(function (functLoc) {
							functLoc.Id = functLoc.Functlocation;
							functLoc.description = functLoc.Descript;
							return functLoc;
						});
						break;
					case "EquipSet":
						searchResults = oData.results.map(function (currentEquipment) {
							currentEquipment.Id = currentEquipment.Equipment;
							currentEquipment.description = currentEquipment.Descript;
							return currentEquipment;
						});
						break;
					}
					localModel.setProperty("/searchResults", searchResults);
					var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
					var oConditionsPage = sap.ui.core.Fragment.byId("searcherFragment", "searchResultsPage");
					oNavCon.to(oConditionsPage);
					//that._resizeTableColumns("skusTable");
					oBusyDialog.close();
				},
				error: function (oError) {
					oBusyDialog.close();
					if(oError.response.statusCode == 504) {
						sap.m.MessageBox.error("A consulta não pode finalizar porque tem muitos elementos, selecione filtros mais estritos");
					} else {
						oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
						oDataModel.fireRequestFailed(oError);	
					}
					
				}
			});
		},
		variantBack: function () {
			var oNavCon = sap.ui.core.Fragment.byId("searcherFragment", "navContainer");
			oNavCon.back();
		},
		cleanSearch: function () {
			var localModel = sap.ui.getCore().getModel();
			var fieldsToClean = this.getTabFields();

			fieldsToClean.forEach(function (fieldToClean) {
				var field = localModel.getProperty("/" + fieldToClean.Name);
				field.Low = "";
				field.High = "";
				field.Conditions = [];

				if (fieldToClean.Name === "S_CLINT") {
					localModel.setProperty("/ClassSelected", "");
					localModel.setProperty("/Characteristic", []);
				}

				localModel.setProperty("/" + fieldToClean.Name, field);
			});

			this.getView().getModel().updateBindings(true);
		},

		handleVariantResultSelect: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var searchText = oEvent.getSource().getTitle();
			//localModel.setProperty("/searchText", searchText, localModel, true);
			if (localModel.getProperty("/FilterCriteria") == "FuncLocSet") {
				localModel.setProperty("/FunctLocSelected", searchText, localModel, true);
			} else if (localModel.getProperty("/FilterCriteria") == "EquipSet") {
				localModel.setProperty("/EquipSelected", searchText, localModel, true);
			}
			// PS - Mercedes selecciona automaticamente todos los campos del equipo
			var searchResults = localModel.getProperty("/searchResults"),
				oEquip = searchResults.filter(function (e) {
					return e.Equipment === searchText;
				})[0],
				dfdWorkCenters = $.Deferred();

			var plant = localModel.getProperty("/Plants").filter(function (p) {
					return p.Werks === oEquip.Planplant;
				})[0],
				order = localModel.getProperty("/Order");
			order.Plangroup = oEquip.Plangroup;
			order.Planplant = plant;

			localModel.setProperty("/Order", order);
			localModel.setProperty("/EquipObject", oEquip);
			
			this._loadEntities(oEquip.Planplant, undefined, undefined, undefined, dfdWorkCenters);
			$.when(dfdWorkCenters).then(function () {
				var aWorkCenters = localModel.getProperty("/PmWorkCenters");

				if (oEquip) {
					var oOrder = localModel.getProperty("/Order"),
						oWorkCenter = aWorkCenters.filter(function (w) {
							return w.Objid === oEquip.Workcenter;
						})[0];
					oOrder.MnWkCtr = oWorkCenter;
					oOrder.FunctLoc = oEquip.Functlocation;
					localModel.setProperty("/Order", oOrder);
					// PS - Mercedes - Primera operacion se crea por defecto
					order.OrderOperationSet = [{
						Activity: "10",
						ControlKey: "PM01",
						Plant: oOrder.Planplant,
						Description: oOrder.ShortText,
						WorkCntr: oOrder.MnWkCtr.Arbpl,
						WorkActual: 0
					}];
					localModel.setProperty("/ParentOperations", order.OrderOperationSet);
				}
			});
			this.closeSearcher();
		},

		// PS - Mercedes - Primera operacion se crea por defecto con texto igual a la orden
		onShortTextChange: function (oEvent) {
			var oOrder = sap.ui.getCore().getModel().getProperty("/Order");
			/*if (oOrder.OrderOperationSet.length > 0) {
				oOrder.OrderOperationSet[0].Description = oOrder.ShortText;
			}*/
		},

		getTabFields: function () {
			var localModel = sap.ui.getCore().getModel();
			var filterCriteria = localModel.getProperty("/FilterCriteria");
			var fields = [];
			//TODO: Mover al archivo de configuracion config.
			switch (filterCriteria) {
			case "FuncLocSet":
				fields = [{
					Name: "SWERK"
				}, {
					Name: "BEBER"
				}, {
					Name: "STORT"
				}];
				break;

			case "EquipSet":
				fields = [{
					Name: "TIDNR"
				}, {
					Name: "EQUNR"
				}, {
					Name: "TPLNR"
				}, {
					Name: "STRNO"
				}];
				break;
			}

			return fields;
		},

		handleValueHelp: function (oEvent) {
			var localModel = sap.ui.getCore().getModel();
			var sInputValue = oEvent.getSource().getValue();
			var i18n = sap.ui.getCore().getModel("i18n").getResourceBundle();

			// create value help dialog
			if (!this._valueHelpDialog) {
				this._valueHelpDialog = sap.ui.xmlfragment("valuehelp", "com.blueboot.createorder.view.ValueHelp", this);
				this._valueHelpDialog.setModel(i18n, "i18n");
				this._valueHelpDialog.setModel(localModel);
				this.getView().addDependent(this._valueHelpDialog);
			}

			//this.inputId = oEvent.getSource().getId();

			var sPath = oEvent.getSource().mBindingInfos.value.binding.sPath;
			var field = sPath && sPath.split("/") ? sPath.split("/")[1] : "";
			if (sPath === "Low" || sPath === "High") {
				field = localModel.getProperty("/IndexField").replace("/", "");
			}
			localModel.setProperty("/IndexFieldsPath", sPath, localModel, true);

			var listDataProperty = "/" + field + "Help";
			var listData = localModel.getProperty(listDataProperty);
			var dfd = $.Deferred();

			if (!listData) {
				dfd = this.getDataForValueHelp(field);
			} else {
				dfd.resolve();
			}

			var that = this;
			var oBusyDialog = new BusyDialog();
			oBusyDialog.open();
			$.when(dfd).then(function () {

				listData = localModel.getProperty(listDataProperty).map(function (x) {
					x.Id = x.Id || x[config.ValueHelp[field].Key];
					x.description = x.description || x[config.ValueHelp[field].Value];
					x.additionalData = x.additionalData || x[config.ValueHelp[field].AdditionalData];
					return x;
				});
				localModel.setProperty("/ValueHelpItems", listData);

				// create a filter for the binding
				var oFilter = new Filter({
					filters: [
						new Filter("Id", sap.ui.model.FilterOperator.Contains, sInputValue),
						new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sInputValue)
					],
					and: false
				})

				that._valueHelpDialog.getBinding("items").filter([oFilter]);

				// open value help dialog filtered by the input value
				that._valueHelpDialog.open(sInputValue);
			}).always(function () {
				oBusyDialog.close()
			});
		},

		getDataForValueHelp: function (oField) {
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var localModel = sap.ui.getCore().getModel();
			var dfd = $.Deferred();

			oDataModel.read(config.ValueHelp[oField].Url, {
				success: function (oData, response) {
					localModel.setProperty("/" + oField + "Help", oData.results);
					dfd.resolve();
				},
				error: function (oError) {
					oError.customMessage = sap.ui.getCore().getModel("i18n").getResourceBundle().getText("SOMETHING_HAS_HAPPENED");
					oDataModel.fireRequestFailed(oError);
					dfd.reject();
				}
			});

			return dfd;
		},

		_handleValueHelpSearch: function (evt) {
	      var sValue = evt.getParameter("query");
	      var oFilter = new Filter({
	        filters: [
	          new Filter("Id", sap.ui.model.FilterOperator.Contains, sValue),
	          new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sValue),
	          new Filter("description", sap.ui.model.FilterOperator.Contains, sValue)
	        ],
	        and: false
	      });
	      //this.getView().byId("searchResultsList").getBinding("items").filter([oFilter]); //searcherFragment--resultsList esta es la id?
	      evt.getSource().getBinding("items").filter([oFilter]);
	    },
	    
	    _handleResultsSearch: function (evt) {
	      var sValue = evt.getParameter("query");
	      var oFilter = new Filter({
	        filters: [
	          new Filter("Id", sap.ui.model.FilterOperator.Contains, sValue),
	          new Filter("additionalData", sap.ui.model.FilterOperator.Contains, sValue),
	          new Filter("description", sap.ui.model.FilterOperator.Contains, sValue)
	        ],
	        and: false
	      });
	      evt.getSource().getParent().getContent()[1].getBinding("items").filter([oFilter]);
	    },
	    
		_handleValueHelpClose: function (evt) {
			var oSelectedItem = evt.getParameter("selectedItem");
			if (oSelectedItem) {
				//var input = sap.ui.core.Fragment.byId("searcherFragment", this.inputId.replace("searcherFragment--", ""));
				var localModel = sap.ui.getCore().getModel();
				var sPath = localModel.getProperty("/IndexFieldsPath");
				localModel.setProperty(sPath, oSelectedItem.getTitle());
				//input.setValue(oSelectedItem.getTitle());
			}
			evt.getSource().getBinding("items").filter([]);
		},

		handleFilterAccept: function () {
			var localModel = sap.ui.getCore().getModel();
			var oDataModel = sap.ui.getCore().getModel("oDataModel");
			var filterCriteria = localModel.getProperty("/FilterCriteria");
			var searchText = localModel.getProperty("/searchText").toUpperCase();
			var plants = localModel.getProperty("/PlantSet");
			var aPlantIndex;
			var mParameters = {};
			var that = this;
			this._dialog.setBusy(true);
			switch (filterCriteria) {
			case "WorkCenter":
				//DEPRECATED
				/*
				var oItem = localModel.getProperty(oEvent.getParameter("listItem").getBindingContextPath());
				if (oItem) {
					var plants = localModel.getProperty("/PlantSet");
					var aPlantIndex = plants.findIndex(function (x) {
						return x.Werks === oItem.Id;
					});
					this.setOfflineContext(plants[aPlantIndex]);
					//oEvent.getSource().getParent().close();
				}
				*/
				break;
			case "FuncLocSet":
				if (searchText) {
					oDataModel.read("FuncLocSet('" + searchText + "')", {
						success: function (odata) {
							aPlantIndex = plants.findIndex(function (x) {
								return x.Werks === odata.Planplant;
							});
							mParameters.actualPlant = plants[aPlantIndex];
							mParameters.funcLoc = odata.Functlocation;
							that.setOfflineContext(mParameters);
							that._dialog.setBusy(false);
							that.closeDialog();
						},
						error: function (oError) {
							that._dialog.setBusy(false);
							oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
							oDataModel.fireRequestFailed(oError);
						}
					});
				}
				break;
			case "EquipSet":
				//This should happen only in online mode

				if (searchText) {
					oDataModel.read("EquipSet('" + searchText + "')", {
						success: function (odata) {
							aPlantIndex = plants.findIndex(function (x) {
								return x.Werks === odata.Planplant;
							});
							localModel.setProperty("/ActualPlant", plants[aPlantIndex], localModel, true);
							localModel.setProperty("/Equipments", [odata], localModel, true);
							mParameters.actualPlant = plants[aPlantIndex];
							mParameters.ignoreTree = true;

							$.when(this.bindTreeInfo(mParameters)).then(function () {
								that.handleEquipListItemPress(null, odata);
								that._dialog.setBusy(false);
								that.closeDialog();
							});
							that.closeDialog();
						},
						error: function (oError) {
							that._dialog.setBusy(false);
							oError.customMessage = that._oBundle.getText("SOMETHING_HAS_HAPPENED");
							oDataModel.fireRequestFailed(oError);
						}
					});
				}
				break;
			}

		},

		onScanFilter: function () {      
	      var that = this;
	      var permissions = cordova.plugins.permissions;
	      permissions.checkPermission(permissions.CAMERA, function( status ){
	        if ( status.hasPermission ) {
	          that.qrFilter();
	        }
	        else {
	          permissions.requestPermission(permissions.CAMERA, success, error); 
	          function error() {
	            console.warn('Camera permission is not turned on');
	          }
	           
	          function success( status ) {
	            if( !status.hasPermission ) error();
	          }
	        }
	      });
	    },

	    qrFilter: function() {
	      var that = this;
			if (!this._qrDialog) {
				this._qrDialog = sap.ui.xmlfragment("com.blueboot.createorder.view.QR", this);
				this.getView().addDependent(this._selectDialog);
			}
			this._qrDialog.open();

			this._scanner = new Instascan.Scanner({
					video: sap.ui.getCore().byId('preview').$()[0],
					mirror: false
			});

			this._scanner.addListener('scan', function (content) {
				that._qrDialog.close();
				that._scanner.stop();
				var localModel = sap.ui.getCore().getModel();
				localModel.setProperty("/EquipSelected", content, localModel, true);
				that._loadEquipData();
			});

			Instascan.Camera.getCameras().then(function (cameras) {
				if (!jQuery.device.is.phone) {
					if (cameras.length > 0) {
						that._scanner.start(cameras[0]);
					} else {
						console.error('No cameras found.');
					}
				} else {
					if (cameras.length > 0) {
						if (cameras.length == 1) {
							that._scanner.start(cameras[0]);
						} else {
							that._scanner.start(cameras[1]);
						}
					} else {
						console.error('No cameras found.');
					}
				}
			}).catch(function (e) {
	        	console.error(e);
    		});
	    },

		qrClose: function () {
			if (this._qrDialog) {
				this._qrDialog.close();
				this._scanner.stop();
			}
		},
    
		qrDialogAfterClose: function () {
			this._qrDialog.destroy();
			this._qrDialog = null;
		},
	});
});