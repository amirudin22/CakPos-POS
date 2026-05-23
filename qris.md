aku ingin kamu bisa mengimplementasikan qris di aplikasi ini dengan flow di bawah ini:

saat aplikasi sudah di upload user. maka aplikasi akan memproses qris tersebut kedalam bentuk string base64 dan bisa di download oleh user. tapi tidak hanya itu saja, user bisa mengupload qris tersebut dan aplikasi dapat menggenerate qris tersebut saat proses checkout, karena ini payment cashless, perlu proses foto bukti pembayaran pelanggan, untuk antisipi error dari phak bank.

00020101021126690021ID.CO.BANKMANDIRI.WWW01189360000801580890410211715808904160303UKE51440014ID.CO.QRIS.WWW0215ID10243225623630303UKE520427415303360540455005802ID5911Naira sosis6015Surabaya (Kota)61056029662070703A016304716B

string ndi atas adalah contoh qris statis yang telah aku konfigurasi ulang untuk penentuan nominal pembayara, sebenarnya user juga bisa melakukan secara langsung melalui merchant terkait, namun akan meningkatkan UX , jika proses tersebut bisa di lakukan atau terintegrasi dalam proses kasir.
