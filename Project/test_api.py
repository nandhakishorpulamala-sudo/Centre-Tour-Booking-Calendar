import json
import unittest
import os
from app import app
from db import get_db_connection, init_db

class TestCentreTourAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize database with seed data for tests
        init_db()

    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_01_get_enquiries(self):
        """Test listing enquiries and AI suggestions enrichment"""
        response = self.client.get('/api/enquiries')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(len(data) > 0)
        # Check if AI fields are present
        first_enq = data[0]
        self.assertIn('ai_priority', first_enq)
        self.assertIn('ai_recommendation', first_enq)
        self.assertIn('whatsapp_template', first_enq)
        self.assertIn('email_subject', first_enq)

    def test_02_create_enquiry_validation_error(self):
        """Test validation error when missing fields"""
        payload = {
            "parent_name": "Test Parent",
            # missing child_name
            "child_age": "4",
            "contact_phone": "12345678",
            "contact_email": "test@parent.com"
        }
        response = self.client.post('/api/enquiries', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn("error", data)

    def test_03_create_enquiry_success(self):
        """Test successful parent enquiry creation"""
        payload = {
            "parent_name": "Test Parent",
            "child_name": "Test Child",
            "child_age": 5,
            "contact_phone": "12345678",
            "contact_email": "test@parent.com",
            "source": "Parent Enquiry",
            "notes": "Interested in preschool sandbox program"
        }
        response = self.client.post('/api/enquiries', 
                                    data=json.dumps(payload),
                                    content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data.get("success"))
        self.assertIn("id", data)
        
        # Save ID for later tests
        self.__class__.new_enquiry_id = data["id"]

    def test_04_status_transition_success(self):
        """Test transitioning enquiry status in the funnel"""
        enq_id = getattr(self.__class__, 'new_enquiry_id', None)
        self.assertIsNotNone(enq_id, "Requires new_enquiry_id from previous test")
        
        payload = {
            "status": "Tour",
            "tour_date": "2026-06-30",
            "tour_time": "14:00",
            "performed_by": "Counsellor Sarah"
        }
        response = self.client.patch(f'/api/enquiries/{enq_id}/status',
                                      data=json.dumps(payload),
                                      content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("success"))

        # Verify tour was scheduled
        response_tours = self.client.get('/api/tours')
        self.assertEqual(response_tours.status_code, 200)
        tours = json.loads(response_tours.data)
        found_tour = any(t['enquiry_id'] == enq_id and t['tour_date'] == '2026-06-30' for t in tours)
        self.assertTrue(found_tour, "Scheduled tour should be in tours table")

    def test_05_add_activity_success(self):
        """Test logging daycare routines and classroom activities"""
        enq_id = getattr(self.__class__, 'new_enquiry_id', None)
        self.assertIsNotNone(enq_id)
        
        payload = {
            "type": "classroom_activity",
            "description": "Child participated enthusiastically in the sandbox trial.",
            "logged_by": "Teacher Jenny"
        }
        response = self.client.post(f'/api/enquiries/{enq_id}/activities',
                                     data=json.dumps(payload),
                                     content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get("success"))

    def test_06_get_timeline(self):
        """Test timeline audit trail retrieval"""
        enq_id = getattr(self.__class__, 'new_enquiry_id', None)
        self.assertIsNotNone(enq_id)
        
        response = self.client.get(f'/api/enquiries/{enq_id}/timeline')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("logs", data)
        self.assertIn("activities", data)
        self.assertTrue(len(data["logs"]) >= 2) # creation + status change
        self.assertTrue(len(data["activities"]) >= 1) # added activity

    def test_07_export_csv(self):
        """Test exporting data as CSV"""
        response = self.client.get('/api/reports/export')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers['Content-Type'].startswith('text/csv'))
        self.assertIn('attachment; filename=enquiries_report.csv', response.headers['Content-Disposition'])

if __name__ == '__main__':
    unittest.main()
