describe('d2l-all-courses-legacy', function() {
	var widget,
		pinnedEnrollmentEntity,
		unpinnedEnrollmentEntity,
		clock,
		sandbox;

	function fireEvent(component, eventName, detail) {
		component.dispatchEvent(
			new CustomEvent(eventName, {
				bubbles: true,
				composed: true,
				detail: detail
			})
		);
	}

	beforeEach(function(done) {

		pinnedEnrollmentEntity = window.D2L.Hypermedia.Siren.Parse({
			class: ['pinned', 'enrollment'],
			rel: ['https://api.brightspace.com/rels/user-enrollment'],
			links: [{
				rel: ['self'],
				href: '/enrollments/users/169/organizations/1'
			}, {
				rel: ['https://api.brightspace.com/rels/organization'],
				href: '/organizations/123'
			}]
		});
		unpinnedEnrollmentEntity = window.D2L.Hypermedia.Siren.Parse({
			class: ['unpinned', 'enrollment'],
			rel: ['https://api.brightspace.com/rels/user-enrollment'],
			links: [{
				rel: ['self'],
				href: '/enrollments/users/169/organizations/1'
			}, {
				rel: ['https://api.brightspace.com/rels/organization'],
				href: '/organizations/123'
			}]
		});

		sandbox = sinon.sandbox.create();

		widget = fixture('d2l-all-courses-legacy-fixture');
		widget.$['search-widget']._setSearchUrl = sandbox.stub();
		widget._enrollmentsSearchAction = {
			name: 'search-my-enrollments',
			href: '/enrollments/users/169',
			fields: [{
				name: 'parentOrganizations',
				value: ''
			}, {
				name: 'sort',
				value: ''
			}]
		};

		widget.updatedSortLogic = false;

		flush(() => { done(); });

	});

	afterEach(function() {
		if (clock) {
			clock.restore();
		}
		sandbox.restore();
	});

	describe('loading spinner', function() {
		it('should show before content has loaded', function() {
			expect(widget.$$('d2l-loading-spinner:not(#lazyLoadSpinner)').hasAttribute('hidden')).to.be.false;
		});
	});

	describe('advanced search link', function() {
		it('should not render when advancedSearchUrl is not set', function() {
			widget.advancedSearchUrl = null;

			expect(widget._showAdvancedSearchLink).to.be.false;
			expect(widget.$$('.advanced-search-link').hasAttribute('hidden')).to.be.true;
		});

		it('should render when advancedSearchUrl is set', function() {
			widget.advancedSearchUrl = '/test/url';

			expect(widget._showAdvancedSearchLink).to.be.true;
			expect(widget.$$('.advanced-search-link').hasAttribute('hidden')).to.be.false;
		});
	});

	it('should return the correct value from getCourseTileItemCount (should be maximum of pinned or unpinned course count)', function() {
		widget._filteredPinnedEnrollments = [pinnedEnrollmentEntity];
		widget._filteredUnpinnedEnrollments = [unpinnedEnrollmentEntity];

		expect(widget.$$('d2l-all-courses-segregated-content').getCourseTileItemCount()).to.equal(1);
	});

	it('should set getCourseTileItemCount on its child course-tile-grids', function() {
		widget._filteredPinnedEnrollments = [pinnedEnrollmentEntity];
		widget._filteredUnpinnedEnrollments = [unpinnedEnrollmentEntity];
		var courseTileGrids;
		var segregatedContent = widget.$$('d2l-all-courses-segregated-content');
		if (segregatedContent.shadowRoot) {
			courseTileGrids = segregatedContent.shadowRoot.querySelectorAll('d2l-course-tile-grid');
		} else {
			courseTileGrids = segregatedContent.querySelectorAll('d2l-course-tile-grid');
		}
		expect(courseTileGrids.length).to.equal(2);

		for (var i = 0; i < courseTileGrids.length; i++) {
			expect(courseTileGrids[i].getCourseTileItemCount()).to.equal(1);
		}
	});

	it('should load filter menu content when filter menu is opened', function() {
		var semestersTabStub = sandbox.stub(widget.$.filterMenu.$.semestersTab, 'load');
		var departmentsTabStub = sandbox.stub(widget.$.filterMenu.$.departmentsTab, 'load');

		return widget._onFilterDropdownOpen().then(function() {
			expect(semestersTabStub.called).to.be.true;
			expect(departmentsTabStub.called).to.be.true;
		});
	});

	describe('d2l-filter-menu-change event', function() {
		it('should set the _searchUrl with one query string and filterCounts', function() {
			fireEvent(widget.$.filterMenu, 'd2l-filter-menu-change', {
				url: 'http://example.com',
				filterCounts: {
					departments: 12,
					semesters: 0,
					roles: 0
				}
			});

			expect(widget._searchUrl.indexOf('http://example.com?bustCache') !== -1).to.be.true;
			expect(widget._totalFilterCount).to.equal(12);
		});

		it('should set the _searchUrl with multiple query strings and filterCounts', function() {
			fireEvent(widget.$.filterMenu, 'd2l-filter-menu-change', {
				url: 'http://example.com?search=&pageSize=20',
				filterCounts: {
					departments: 15,
					semesters: 0,
					roles: 0
				}
			});

			expect(widget._searchUrl.indexOf('http://example.com?search=&pageSize=20&bustCache=') !== -1).to.be.true;
			expect(widget._totalFilterCount).to.equal(15);
		});
	});

	describe('d2l-menu-item-change event', function() {
		it('should set the _searchUrl', function() {
			fireEvent(widget.$.sortDropdown, 'd2l-menu-item-change', {
				value: 'LastAccessed'
			});

			expect(widget._searchUrl).to.include('/enrollments/users/169?parentOrganizations=&sort=LastAccessed');
		});

	});

	describe('Filter text', function() {
		function fireEvents(filterCount) {
			fireEvent(widget.$.filterMenu, 'd2l-filter-menu-change', {
				url: 'http://example.com',
				filterCounts: {
					departments: filterCount,
					semesters: 0,
					roles: 0
				}
			});
			fireEvent(widget.$.filterDropdownContent, 'd2l-dropdown-close', {});
		}

		it('should read "Filter" when no filters are selected', function() {
			fireEvents(0);
			expect(widget._filterText).to.equal('Filter');
		});

		it('should read "Filter: 1 filter" when any 1 filter is selected', function() {
			fireEvents(1);
			expect(widget._filterText).to.equal('Filter: 1 Filter');
		});

		it('should read "Filter: 2 filters" when any 2 filters are selected', function() {
			fireEvents(2);
			expect(widget._filterText).to.equal('Filter: 2 Filters');
		});
	});

	describe('Alerts', function() {
		var setCourseImageFailureAlert = { alertName: 'setCourseImageFailure', alertType: 'warning', alertMessage: 'Sorry, we\'re unable to change your image right now. Please try again later.' };

		it('should remove a setCourseImageFailure alert when the overlay is opened', function() {
			widget._addAlert('warning', 'setCourseImageFailure', 'failed to do that thing it should do');
			expect(widget._alertsView).to.include({ alertName: 'setCourseImageFailure', alertType: 'warning', alertMessage: 'failed to do that thing it should do' });
			widget.$$('d2l-simple-overlay')._renderOpened();
			expect(widget._alertsView).to.not.include({ alertName: 'setCourseImageFailure', alertType: 'warning', alertMessage: 'failed to do that thing it should do' });
		});

		it('should remove and course image failure alerts before adding and new ones', function() {
			var removeAlertSpy = sandbox.spy(widget, '_removeAlert');
			widget._onSetCourseImage();
			expect(removeAlertSpy.called);
		});

		it('should add an alert after setting the course image results in failure (after a timeout)', function() {
			clock = sinon.useFakeTimers();
			var setCourseImageEvent = { detail: { status: 'failure' } };
			widget._onSetCourseImage(setCourseImageEvent);
			clock.tick(1001);
			expect(widget._alertsView).to.include(setCourseImageFailureAlert);
		});

		it('should not add a setCourseImageFailure warning alert when a request to set the image succeeds', function() {
			var setCourseImageEvent = { detail: { status: 'success' } };
			widget._onSetCourseImage(setCourseImageEvent);
			expect(widget._alertsView).not.to.include(setCourseImageFailureAlert);
		});

		it('should remove a setCourseImageFailure warning alert when a request to set the image is made', function() {
			clock = sinon.useFakeTimers();
			var setCourseImageEvent = { detail: { status: 'failure' } };
			widget._onSetCourseImage(setCourseImageEvent);
			clock.tick(1001);
			expect(widget._alertsView).to.include(setCourseImageFailureAlert);
			setCourseImageEvent = { detail: { status: 'set' } };
			widget._onSetCourseImage(setCourseImageEvent);
			expect(widget._alertsView).not.to.include(setCourseImageFailureAlert);
		});
	});

	describe('opening the overlay', function() {
		it('should initially hide content', function() {
			widget.open();
			expect(widget._showContent).to.be.false;
		});
	});

	describe('closing the overlay', function() {

		it('should clear search text', function() {
			var spy = sandbox.spy(widget, '_clearSearchWidget');
			var searchField = widget.$['search-widget'];

			searchField._getSearchWidget()._getSearchInput().value = 'foo';
			widget.$$('d2l-simple-overlay')._renderOpened();
			expect(spy.called).to.be.true;
			expect(searchField._getSearchWidget()._getSearchInput().value).to.equal('');
		});

		it('should clear filters', function() {
			var spy = sandbox.spy(widget.$.filterMenu, 'clearFilters');

			fireEvent(widget.$.filterMenu, 'd2l-filter-menu-change', {
				filterCounts: {
					departments: 1,
					semesters: 0,
					roles: 0
				}
			});
			fireEvent(widget.$.filterDropdownContent, 'd2l-dropdown-close', {});

			expect(widget._filterText).to.equal('Filter: 1 Filter');
			widget.$$('d2l-simple-overlay')._renderOpened();
			expect(spy.called).to.be.true;
			expect(widget._filterText).to.equal('Filter');
		});

		it('should clear sort', function() {
			var spy = sandbox.spy(widget, '_resetSortDropdown');

			var event = {
				selected: true,
				value: 'OrgUnitCode'
			};

			widget.load();
			fireEvent(widget.$$('d2l-dropdown-menu'), 'd2l-menu-item-change', event);
			expect(widget._searchUrl).to.contain('-PinDate,OrgUnitCode,OrgUnitId');

			widget.$$('d2l-simple-overlay')._renderOpened();
			expect(spy.called).to.be.true;
		});

	});

});
