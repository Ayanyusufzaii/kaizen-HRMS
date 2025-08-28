-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: hrms
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `all_leaves`
--

DROP TABLE IF EXISTS `all_leaves`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `all_leaves` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leaveType` varchar(255) NOT NULL,
  `fromDate` date NOT NULL,
  `toDate` date NOT NULL,
  `status` enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  `emailId` varchar(255) NOT NULL,
  `reason` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `all_leaves`
--

LOCK TABLES `all_leaves` WRITE;
/*!40000 ALTER TABLE `all_leaves` DISABLE KEYS */;
INSERT INTO `all_leaves` VALUES (1,'Annual','2025-05-05','2025-05-15','Rejected','ayan.khan@kaizenque.com','ssss'),(2,'Sick','2025-05-19','2025-05-28','Rejected','ayan.khan@kaizenque.com','sick'),(3,'Annual','2025-05-20','2025-05-29','Rejected','ayan.khan@kaizenque.com','sick'),(4,'Annual','2025-05-07','2025-05-21','Rejected','ayan.khan@kaizenque.com','frtty'),(5,'Annual','2025-06-15','2025-06-25','Approved','ayan.khan@kaizenque.com','sick'),(6,'Sick','2025-06-04','2025-06-06','Rejected','ayan.khan@kaizenque.com','sick'),(7,'Sick','2025-06-04','2025-06-06','Approved','test@gmail.com','test'),(8,'Sick','2025-06-04','2025-06-06','Rejected','ayan.khan@kaizenque.com','test');
/*!40000 ALTER TABLE `all_leaves` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-17 13:06:32
