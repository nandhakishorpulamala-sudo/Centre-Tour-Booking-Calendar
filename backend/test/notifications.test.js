const path = require('path')

describe('notifications', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('sendEmail uses nodemailer createTransport -> sendMail', async () => {
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.EMAIL_FROM = 'no-reply@test'

    // mock nodemailer
    const nodemailer = require('nodemailer')
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'mid' })
    const createTransportMock = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock })

    const notifications = require(path.join('..', 'notifications'))
    const res = await notifications.sendEmail('to@test', 'sub', 'body')
    expect(createTransportMock).toHaveBeenCalled()
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'to@test', subject: 'sub', text: 'body' }))
    expect(res).toEqual(expect.objectContaining({ ok: true }))
    createTransportMock.mockRestore()
  })

  test('sendWhatsApp uses Meta API when provider=meta', async () => {
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WA_META_PHONE_NUMBER_ID = '12345'
    process.env.WA_META_TOKEN = 'token-xyz'

    const axios = require('axios')
    const postMock = jest.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } })

    const notifications = require(path.join('..', 'notifications'))
    const res = await notifications.sendWhatsApp('+911234567890', 'hello')
    expect(postMock).toHaveBeenCalled()
    const calledUrl = postMock.mock.calls[0][0]
    expect(calledUrl).toContain(process.env.WA_META_PHONE_NUMBER_ID)
    postMock.mockRestore()
  })

  test('sendWhatsApp uses Twilio when provider=twilio', async () => {
    process.env.WHATSAPP_PROVIDER = 'twilio'
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'auth'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+1415'

    const axios = require('axios')
    const postMock = jest.spyOn(axios, 'post').mockResolvedValue({ data: { sid: 'SM123' } })

    const notifications = require(path.join('..', 'notifications'))
    const res = await notifications.sendWhatsApp('+911234567890', 'hello')
    expect(postMock).toHaveBeenCalled()
    const calledUrl = postMock.mock.calls[0][0]
    expect(calledUrl).toContain(`/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`)
    postMock.mockRestore()
  })

  test('notifyForAction calls sendEmail and sendWhatsApp for confirm', async () => {
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.EMAIL_FROM = 'no-reply@test'
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WA_META_PHONE_NUMBER_ID = '12345'
    process.env.WA_META_TOKEN = 'token-xyz'

    const nodemailer = require('nodemailer')
    const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'mid' })
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock })

    const axios = require('axios')
    const postMock = jest.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } })

    const notifications = require(path.join('..', 'notifications'))
    const booking = { id: 1, name: 'Test User', email: 'to@test', phone: '+911234567890', preferred_datetime: '2026-06-20T10:00:00Z' }
    const res = await notifications.notifyForAction('confirm', booking)
    expect(sendMailMock).toHaveBeenCalled()
    expect(postMock).toHaveBeenCalled()

    postMock.mockRestore()
  })
})
