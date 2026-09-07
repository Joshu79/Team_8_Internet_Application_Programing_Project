WEEK 3 LAB: API STATEMENTS
218795
220979
223426
221899
METHOD	PATH	PURPOSE	MAPS TO NEED
GET	/users{id}/budget
	Retrieve the user’s current monthly food budget.	StrathsBites needs to get users’ monthly food budget to allow students to know how much they can spend on food daily.
POST	/users{id}/transactions	Creates a new transaction entry when an order is placed.	StrathsBites needs transaction creation to allow the student to track their expenditure on food in the month.
PUT/PATCH	/users{id}/budget	Automatically subtract order/delivery cost from the existing budget.	StrathsBites needs budget deduction to adjust/update the student’s budget after an order is placed.
PUT/PATCH	/users{id}/budget	Update the user’s existing budget amount when their spending limit changes.	StrathsBites needs to update budget when students’ spending limit changes for a certain period.
DELETE	/users{id}/budget	Removes a user’s budget completely- e.g. in case the student graduates from the university.	StrathsBites needs to be able to delete a student’s budget when they graduate in order to  clear space for new users.

