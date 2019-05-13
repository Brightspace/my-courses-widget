/*
`d2l-my-courses-content-animated`
Polymer-based web component for the my-courses content.

This is only used if the `US90527-my-courses-updates` LD flag is OFF
(meaning the `updated-sort-logic` attribute was not added to the `d2l-my-courses` component).

*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
import '@polymer/polymer/polymer-legacy.js';

import '@polymer/iron-scroll-threshold/iron-scroll-threshold.js';
import 'd2l-alert/d2l-alert.js';
import 'd2l-fetch/d2l-fetch.js';
import 'd2l-link/d2l-link.js';
import 'd2l-loading-spinner/d2l-loading-spinner.js';
import 'd2l-simple-overlay/d2l-simple-overlay.js';
import 'd2l-image-selector/d2l-basic-image-selector.js';
import 'd2l-typography/d2l-typography-shared-styles.js';
import '../d2l-all-courses.js';
import './d2l-course-tile-grid.js';
import '../d2l-my-courses-content-behavior.js';
import { Rels } from 'd2l-hypermedia-constants';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';
import { dom } from '@polymer/polymer/lib/legacy/polymer.dom.js';
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = `<dom-module id="d2l-my-courses-content-animated">
	<template strip-whitespace="">
		<style>
			:host {
				display: block;
			}
			@media not all and (hover: hover) {
				:host {
					-webkit-user-select: none;
					user-select: none;
				}
			}
			.my-courses-content {
				padding-top: 10px;
			}
			.spinner-container {
				display: flex;
				justify-content: center;
				align-items: center;
			}
			d2l-alert {
				display: block;
				margin-bottom: 20px;
				clear: both;
			}
			.d2l-body-standard {
				@apply --d2l-body-standard-text;
				margin: 0;
			}
		</style>

		<div class="spinner-container">
			<d2l-loading-spinner hidden$="[[_showContent]]" size="100">
			</d2l-loading-spinner>
		</div>

		<div hidden$="[[!_showContent]]" class="my-courses-content">
			<template is="dom-repeat" items="[[_alertsView]]">
				<d2l-alert type="[[item.alertType]]">
					{{item.alertMessage}}
				</d2l-alert>
			</template>
			<d2l-course-tile-grid
				enrollments="[[_pinnedEnrollments]]"
				tile-sizes="[[_tileSizes]]"
				locale="[[locale]]"
				show-course-code="[[showCourseCode]]"
				show-semester="[[showSemester]]"
				course-updates-config="[[courseUpdatesConfig]]"
				token="[[token]]">
			</d2l-course-tile-grid>
			<d2l-link id="viewAllCourses" hidden$="[[!_hasEnrollments]]" href="javascript:void(0);" on-tap="_openAllCoursesView" on-keypress="_keypressOpenAllCoursesView" on-mouseover="_createAllCourses" on-focus="_createAllCourses" tabindex="0">
				<h3 class="d2l-body-standard">[[_viewAllCoursesLinkText]]</h3>
			</d2l-link>
		</div>

		<div id="allCoursesPlaceholder">
		</div>

		<d2l-simple-overlay id="basic-image-selector-overlay" title-name="{{localize('changeImage')}}" close-simple-overlay-alt-text="{{localize('closeSimpleOverlayAltText')}}" with-backdrop="">
			<iron-scroll-threshold id="image-selector-threshold" on-lower-threshold="_onChangeImageLowerThreshold">
			</iron-scroll-threshold>
			<d2l-basic-image-selector
				image-catalog-location="[[imageCatalogLocation]]"
				organization="[[_setImageOrg]]"
				course-image-upload-cb="[[courseImageUploadCb]]">
			</d2l-basic-image-selector>
		</d2l-simple-overlay>

	</template>

</dom-module>`;

document.head.appendChild($_documentContainer.content);
Polymer({
	is: 'd2l-my-courses-content-animated',

	properties: {
		enrollmentsSearchAction: Object,
		_allEnrollments: {
			type: Array,
			value: function() { return []; }
		},
		_hasEnrollments: {
			type: Boolean,
			value: false
		},
		_pinnedEnrollments: {
			type: Array,
			value: function() { return []; }
		},
		// True when there are pinned enrollments (i.e. `_pinnedEnrollments.length > 0`)
		_hasPinnedEnrollments: {
			type: Boolean,
			value: false
		},
		_viewAllCoursesLinkText: String,
		// Size the tile should render with respect to vw
		_tileSizes: {
			type: Object,
			value: function() { return {}; }
		},
		_pinnedEnrollmentsMap: {
			type: Object,
			value: function() { return {}; }
		}
	},
	behaviors: [
		D2L.MyCourses.CourseTileResponsiveGridBehavior,
		D2L.MyCourses.MyCoursesContentBehaviorLegacy
	],
	listeners: {
		'tile-remove-complete': '_onTileRemoveComplete'
	},
	observers: [
		// Override for MyCoursesContentBehaviorLegacy observer
		'_enrollmentsChanged(_pinnedEnrollments.length, _allEnrollments.length)'
	],

	/*
	* Public API functions
	*/

	// Override for MyCoursesContentBehaviorLegacy.getCourseTileItemCount
	getCourseTileItemCount: function() {
		return this._pinnedEnrollments.length;
	},

	/*
	* Listeners
	*/

	// Override for MyCoursesContentBehaviorLegacy._onEnrollmentPinnedMessage
	_onEnrollmentPinnedMessage: function(e) {
		if (dom(e).rootTarget === this) return;

		var enrollment = this._orgUnitIdMap[e.detail.orgUnitId];
		if (enrollment) {
			if (e.detail.isPinned) {
				this._addToPinnedEnrollments(enrollment);
			} else {
				this._removeFromPinnedEnrollments(enrollment);
			}
			setTimeout(this._onStartedInactiveAlert.bind(this), 50);
		} else {
			this._refetchEnrollments();
		}
	},
	_onTileRemoveComplete: function(e) {
		if (e.detail.pinned) {
			this._addToPinnedEnrollments(e.detail.enrollment);
		} else {
			this._removeFromPinnedEnrollments(e.detail.enrollment);
		}
	},
	// Override for MyCoursesContentBehaviorLegacy._onCourseTileOrganization
	_onCourseTileOrganization: function() {
		if (this._initiallyVisibleCourseTileCount === 0 && this._courseTileOrganizationEventCount === 0) {
			// If no course tiles are initially visible (widget is outside of initial viewport)
			// then we can say we're already finished loading the visible organizations and images
			this.performanceMark('d2l.my-courses.visible-organizations-complete');
			this.performanceMeasure(
				'd2l.my-courses.meaningful.visible',
				'd2l.my-courses.attached',
				'd2l.my-courses.visible-organizations-complete'
			);
			this.performanceMark('d2l.my-courses.visible-images-complete');
			this.performanceMeasure(
				'd2l.my-courses.hero',
				'd2l.my-courses.attached',
				'd2l.my-courses.visible-images-complete',
				true
			);
		}

		this._courseTileOrganizationEventCount++;

		if (this._courseTileOrganizationEventCount === this._initiallyVisibleCourseTileCount) {
			// Only show content once the last visible organization has loaded, to reduce jank
			this._showContent = true;
			this.performanceMark('d2l.my-courses.visible-organizations-complete');
			this.performanceMeasure(
				'd2l.my-courses.meaningful.visible',
				'd2l.my-courses.attached',
				'd2l.my-courses.visible-organizations-complete'
			);
		} else if (this._courseTileOrganizationEventCount === this._pinnedEnrollments.length) {
			this.performanceMark('d2l.my-courses.all-organizations-complete');
			this.performanceMeasure(
				'd2l.my-courses.meaningful.all',
				'd2l.my-courses.attached',
				'd2l.my-courses.all-organizations-complete'
			);
		}
	},
	// Override for MyCoursesContentBehaviorLegacy._onStartedInactiveAlert
	_onStartedInactiveAlert: function(e) {
		this._removeAlert('startedInactiveCourses');

		var removed = (e && e.detail && e.detail.type) === 'remove';
		if (this.$$('d2l-course-tile-grid').checkForStartedInactive(removed)) {
			this._addAlert('warning', 'startedInactiveCourses', this.localize('startedInactiveAlertPinned'));
		}
	},

	// Override for MyCoursesContentBehaviorLegacy._openAllCoursesView
	_openAllCoursesView: function(e) {
		this._createAllCourses();

		var allCourses = this.$$('d2l-all-courses-legacy');

		allCourses.enrollmentsSearchAction = this.enrollmentsSearchAction;
		allCourses.locale = this.locale;
		allCourses.advancedSearchUrl = this.advancedSearchUrl;
		allCourses.filterStandardSemesterName = this.standardSemesterName;
		allCourses.filterStandardDepartmentName = this.standardDepartmentName;
		allCourses.updatedSortLogic = false;
		allCourses.showCourseCode = this.showCourseCode;
		allCourses.showSemester = this.showSemester;
		allCourses.courseUpdatesConfig = this.courseUpdatesConfig;
		allCourses.hasEnrollmentsChanged = this._hasEnrollmentsChanged;

		allCourses.open();

		e.preventDefault();
		e.stopPropagation();
	},

	// Override for MyCoursesContentBehaviorLegacy._computeHasOnlyPastCourses
	_computeHasOnlyPastCourses: function() {
		return false;
	},

	_getTileGrid: function() {
		return this.$$('d2l-course-tile-grid');
	},

	_refreshTileGridImages: function() {
		this.$$('d2l-course-tile-grid').refreshCourseTileImage(this._setImageOrg);
	},

	/*
	* Observers
	*/

	// Override for MyCoursesContentBehaviorLegacy._enrollmentsChanged
	_enrollmentsChanged: function(pinnedEnrollmentsLength, allEnrollmentsLength) {
		this._hasPinnedEnrollments = pinnedEnrollmentsLength > 0;
		this._hasEnrollments = allEnrollmentsLength > 0;

		this._clearAlerts();

		if (this._hasEnrollments) {
			if (!this._hasPinnedEnrollments) {
				this._addAlert('call-to-action', 'noPinnedCourses', this.localize('noPinnedCoursesWidgetMessage'));
			}
		} else {
			this._addAlert('call-to-action', 'noCourses', this.localize('noCoursesMessage'));
		}
	},

	/*
	* Utility/helper functions
	*/
	// Override for MyCoursesContentBehaviorLegacy._createFetchEnrollmentsUrl
	_createFetchEnrollmentsUrl: function(bustCache) {
		var query = {
			pageSize: 20,
			embedDepth: 1,
			sort: '-PinDate,OrgUnitName,OrgUnitId',
			orgUnitTypeId: this.orgUnitTypeIds,
			autoPinCourses: true
		};
		var enrollmentsSearchUrl = this.createActionUrl(this.enrollmentsSearchAction, query);

		if (bustCache) {
			enrollmentsSearchUrl += '&bustCache=' + Math.random();
		}
		return enrollmentsSearchUrl;
	},
	// Override for MyCoursesContentBehaviorLegacy._populateEnrollments
	_populateEnrollments: function(enrollmentsEntity) {
		if (!enrollmentsEntity || !enrollmentsEntity.entity) {
			return;
		}

		enrollmentsEntity = enrollmentsEntity && enrollmentsEntity.entity;
		var enrollmentEntities = enrollmentsEntity.getSubEntitiesByClass('enrollment');
		this._hasMoreEnrollments = enrollmentsEntity.hasLinkByRel('next');
		var newEnrollments = [];
		var newPinnedEnrollments = [];

		enrollmentEntities.forEach(function(enrollment) {
			var enrollmentId = this.getEntityIdentifier(enrollment);

			if (enrollment.hasClass('pinned')) {
				if (!this._pinnedEnrollmentsMap.hasOwnProperty(enrollmentId)) {
					newPinnedEnrollments.push(enrollment);
					this._pinnedEnrollmentsMap[enrollmentId] = true;
				}
			} else {
				if (this._pinnedEnrollmentsMap.hasOwnProperty(enrollmentId)) delete this._pinnedEnrollmentsMap[enrollmentId];
			}

			var orgHref = (enrollment.getLinkByRel(Rels.organization) || {}).href;
			var orgUnitId = this._getOrgUnitIdFromHref(orgHref);
			if (!this._orgUnitIdMap.hasOwnProperty(orgUnitId)) {
				this._orgUnitIdMap[orgUnitId] = enrollment;
				newEnrollments.push(enrollment);
			}
		}, this);

		this._pinnedEnrollments = this._pinnedEnrollments.concat(newPinnedEnrollments);
		this._allEnrollments = this._allEnrollments.concat(newEnrollments);
		this._viewAllCoursesLinkText = this.localize('viewAllCourses');
		this._hasEnrollments = this._allEnrollments.length > 0;

		var colNum = this._calcNumColumns(this._getAvailableWidth(dom(this.root).node.host), this._pinnedEnrollments.length);
		this._tileSizes = (colNum === 2) ?
			{ mobile: { maxwidth: 767, size: 50 }, tablet: { maxwidth: 1243, size: 33 }, desktop: { size: 20 } } :
			{ mobile: { maxwidth: 767, size: 100 }, tablet: { maxwidth: 1243, size: 67 }, desktop: { size: 25 } };

		this.fire('recalculate-columns');

		var lastEnrollment = enrollmentEntities[enrollmentEntities.length - 1];
		if (lastEnrollment.hasClass('pinned') && this._hasMoreEnrollments) {
			var url = enrollmentsEntity.getLinkByRel('next').href;
			return this.sirenEntityStoreFetch(url, this.token)
				.then(this._populateEnrollments.bind(this));
		}
	},
	_addToPinnedEnrollments: function(enrollment) {
		if (!enrollment) return;

		var enrollmentId = this.getEntityIdentifier(enrollment);
		if (!this._pinnedEnrollmentsMap.hasOwnProperty(enrollmentId)) {
			this._pinnedEnrollmentsMap[enrollmentId] = true;
			this.unshift('_pinnedEnrollments', enrollment);
		}
	},
	_removeFromPinnedEnrollments: function(enrollment) {
		var enrollmentId = typeof enrollment === 'string'
			? enrollment
			: this.getEntityIdentifier(enrollment);

		for (var index = 0; index < this._pinnedEnrollments.length; index++) {
			var unpinnedEnrollmentId = this.getEntityIdentifier(this._pinnedEnrollments[index]);
			if (unpinnedEnrollmentId === enrollmentId) {
				this.splice('_pinnedEnrollments', index, 1);
				if (this._pinnedEnrollmentsMap.hasOwnProperty(enrollmentId)) delete this._pinnedEnrollmentsMap[enrollmentId];
				break;
			}
		}
	}
});
